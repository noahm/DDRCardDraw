import { nanoid } from "nanoid";
import type { Action } from "@reduxjs/toolkit";
import { reducer } from "../state/root-reducer";
import type { AppState } from "../state/store";
import type { ReduxAction, Roomstate, StampedAction } from "./types";

/** how long to wait for the server to confirm receipt before re-sending */
const ACK_TIMEOUT_MS = 5000;
/** total transmissions per action on a live connection before giving up */
const MAX_SEND_ATTEMPTS = 4;
/** how long to wait for a catch-up reply before re-asking */
const CATCHUP_TIMEOUT_MS = 5000;
/** catch-up requests before falling back to a full reconnect */
const MAX_CATCHUP_ATTEMPTS = 3;

interface SocketLike {
  readyState: number;
  send(data: string): void;
}

/** An action taken locally that hasn't yet been confirmed by the server */
interface PendingEntry {
  message: ReduxAction & { id: string };
  attempts: number;
  timer?: ReturnType<typeof setTimeout>;
}

/**
 * Client half of the replicated state machine.
 *
 * Maintains the invariant: display state == confirmed state + pending
 * actions replayed in order.
 *
 * - `confirmed` is built exclusively from server-ordered (seq-stamped)
 *   actions, so every replica converges on the same state.
 * - `pending` holds locally-dispatched actions awaiting the server's echo.
 *   They're already applied to the display store optimistically; unconfirmed
 *   sends re-transmit on a timeout (the server dedupes by id) and anything
 *   still pending across a reconnect is rebased onto the fresh roomstate.
 *
 * When a gap in `seq` is observed on a live socket (a missed broadcast), the
 * manager repairs incrementally: it asks the server to replay the missing
 * stamped actions (catch-up) rather than tearing down the socket for a full
 * snapshot. Broadcasts that arrive while the repair is in flight are buffered
 * and replayed once the gap is filled.
 *
 * Against a server that predates seq stamping (`lastSeq == null`), this
 * degrades to plain optimistic apply with ack-based pending tracking:
 * no rebasing, no give-up rollback, no catch-up.
 */
export class SyncManager {
  private pending = new Map<string, PendingEntry>();
  private confirmed: AppState | null = null;
  private lastSeq: number | null = null;
  /** true from detecting a missed broadcast until the repair completes */
  private resyncing = false;
  /** live broadcasts received while a catch-up repair is in flight */
  private buffer: ReduxAction[] = [];
  private catchupTimer?: ReturnType<typeof setTimeout>;
  private catchupAttempts = 0;

  constructor(
    private socket: SocketLike,
    private handlers: {
      /** apply a foreign action directly to the display store */
      dispatchForeign: (action: Action) => void;
      /** replace the display store state wholesale after a rebase */
      applyState: (state: AppState) => void;
      /** ask the server to replay every stamped action after `since` */
      requestCatchup: (since: number) => void;
      /** repair could not proceed incrementally; force a fresh roomstate */
      resync: () => void;
      /** an action was abandoned after repeated unconfirmed sends */
      onGiveUp: (action: Action) => void;
    },
  ) {}

  /** send a locally-dispatched action (already applied to the display store) */
  send(action: Action) {
    const entry: PendingEntry = {
      message: { type: "action", action, id: nanoid() },
      attempts: 0,
    };
    this.pending.set(entry.message.id, entry);
    this.transmit(entry);
  }

  /**
   * A fresh roomstate arrived (initial connect, reconnect, or catch-up
   * fallback). Adopts it as the confirmed state, drops pending actions the
   * server already applied, and re-sends the rest. Returns the state the
   * display store should show: confirmed with remaining pending rebased on top.
   */
  handleRoomstate(roomstate: Roomstate): AppState {
    this.endCatchup();
    // a full snapshot supersedes anything buffered mid-repair
    this.buffer = [];
    this.confirmed = roomstate.state;
    this.lastSeq = roomstate.seq ?? null;
    const applied = new Set(roomstate.recentActionIds ?? []);
    for (const entry of Array.from(this.pending.values())) {
      clearTimeout(entry.timer);
      if (applied.has(entry.message.id)) {
        // its effect is already baked into the snapshot
        this.pending.delete(entry.message.id);
        continue;
      }
      entry.attempts = 0;
      this.transmit(entry);
    }
    return this.rebase();
  }

  /**
   * An action broadcast arrived — our own echoed back, or another client's.
   * Advances the confirmed state and keeps the display state consistent.
   */
  handleRemoteAction(message: ReduxAction) {
    if (!this.confirmed) {
      // roomstate always precedes broadcasts on a connection, so this is
      // unreachable; degrade gracefully if it somehow isn't
      if (!(message.id && this.pending.has(message.id))) {
        this.handlers.dispatchForeign(message.action);
      }
      return;
    }
    if (this.resyncing) {
      // hold live broadcasts until the in-flight catch-up fills the gap
      if (message.seq != null) this.buffer.push(message);
      return;
    }
    this.ingest(message);
  }

  /**
   * The server replayed the stamped actions filling a detected gap. Apply
   * them in order, then drain any live broadcasts buffered during the repair.
   */
  handleCatchup(actions: StampedAction[]) {
    if (!this.confirmed) return;
    this.endCatchup();
    for (const message of actions) {
      if (this.resyncing) {
        // a further gap opened mid-replay; buffer the rest for the next round
        this.buffer.push(message);
        continue;
      }
      this.ingest(message);
    }
    if (!this.resyncing) this.drainBuffer();
  }

  /** the server says this id was applied earlier (duplicate re-send) */
  handleAck(id: string) {
    this.settle(id);
  }

  /** count of actions awaiting confirmation */
  get pendingCount() {
    return this.pending.size;
  }

  dispose() {
    for (const entry of this.pending.values()) {
      clearTimeout(entry.timer);
    }
    this.pending.clear();
    this.endCatchup();
    this.buffer = [];
  }

  /** apply a single stamped/foreign broadcast, maintaining the invariant */
  private ingest(message: ReduxAction) {
    if (message.seq != null && this.lastSeq != null) {
      if (message.seq <= this.lastSeq) {
        // stale re-delivery of something already reflected in confirmed
        if (message.id) this.settle(message.id);
        return;
      }
      if (message.seq > this.lastSeq + 1) {
        // a broadcast went missing: buffer this one and repair incrementally
        this.buffer.push(message);
        this.startCatchup();
        return;
      }
    }
    if (message.seq != null) {
      this.lastSeq = message.seq;
    }
    this.confirmed = reducer(this.confirmed!, message.action);

    const ownEntry = message.id ? this.pending.get(message.id) : undefined;
    if (ownEntry) {
      const wasFirst = this.pending.keys().next().value === message.id;
      this.settle(message.id!);
      // the display store already reflects our own action optimistically;
      // unless the stream confirmed it out of order, no dispatch is needed
      if (!wasFirst) {
        this.handlers.applyState(this.rebase());
      }
      return;
    }
    if (this.pending.size === 0) {
      // no local speculation: the foreign action applies directly
      this.handlers.dispatchForeign(message.action);
    } else {
      // a foreign action was ordered underneath our unconfirmed ones
      this.handlers.applyState(this.rebase());
    }
  }

  /** begin (or continue) an incremental catch-up for the current gap */
  private startCatchup() {
    this.resyncing = true;
    this.catchupAttempts = 0;
    this.sendCatchup();
  }

  private sendCatchup() {
    this.catchupAttempts += 1;
    this.handlers.requestCatchup(this.lastSeq!);
    clearTimeout(this.catchupTimer);
    this.catchupTimer = setTimeout(() => {
      if (!this.resyncing) return;
      if (this.catchupAttempts >= MAX_CATCHUP_ATTEMPTS) {
        // catch-up isn't getting through; fall back to a full reconnect
        this.endCatchup();
        this.handlers.resync();
        return;
      }
      this.sendCatchup();
    }, CATCHUP_TIMEOUT_MS);
  }

  private endCatchup() {
    clearTimeout(this.catchupTimer);
    this.catchupTimer = undefined;
    this.resyncing = false;
  }

  /** replay live broadcasts buffered during a repair, in seq order */
  private drainBuffer() {
    const buffered = this.buffer.splice(0).sort((a, b) => a.seq! - b.seq!);
    for (const message of buffered) {
      if (this.resyncing) {
        // ingest reopened a gap; hold the remainder for the next round
        this.buffer.push(message);
        continue;
      }
      this.ingest(message);
    }
  }

  /** replay pending actions over the confirmed state */
  private rebase(): AppState {
    let state = this.confirmed!;
    for (const entry of this.pending.values()) {
      state = reducer(state, entry.message.action);
    }
    return state;
  }

  /**
   * removes a pending action from our list of pending as the server has now confirmed it
   */
  private settle(id: string) {
    const entry = this.pending.get(id);
    if (!entry) return;
    clearTimeout(entry.timer);
    this.pending.delete(id);
  }

  private transmit(entry: PendingEntry) {
    if (this.socket.readyState === WebSocket.OPEN) {
      entry.attempts += 1;
      this.socket.send(JSON.stringify(entry.message));
    }
    entry.timer = setTimeout(
      () => this.handleAckTimeout(entry),
      ACK_TIMEOUT_MS,
    );
  }

  private handleAckTimeout(entry: PendingEntry) {
    if (!this.pending.has(entry.message.id)) return;
    if (this.socket.readyState !== WebSocket.OPEN) {
      // connection is down: hold the action for replay after the reconnect,
      // which arrives via handleRoomstate
      return;
    }
    if (entry.attempts >= MAX_SEND_ATTEMPTS) {
      this.pending.delete(entry.message.id);
      if (this.lastSeq != null && this.confirmed) {
        // roll the abandoned change back out of the display state
        this.handlers.applyState(this.rebase());
      }
      this.handlers.onGiveUp(entry.message.action);
      return;
    }
    this.transmit(entry);
  }
}
