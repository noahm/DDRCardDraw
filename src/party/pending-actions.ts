import { nanoid } from "nanoid";
import type { Action } from "@reduxjs/toolkit";
import type { ReduxAction } from "./types";

/** how long to wait for the server to confirm receipt before re-sending */
const ACK_TIMEOUT_MS = 5000;
/** total transmissions per action on a live connection before giving up */
const MAX_SEND_ATTEMPTS = 4;

interface SocketLike {
  readyState: number;
  send(data: string): void;
}

interface PendingEntry {
  message: Required<ReduxAction>;
  attempts: number;
  timer?: ReturnType<typeof setTimeout>;
}

/**
 * Tracks actions sent to the party server until receipt is confirmed.
 * Unconfirmed sends are re-transmitted on a timeout (the server dedupes by
 * message id), and anything still pending when a fresh roomstate arrives
 * after a reconnect is replayed both locally and over the wire.
 */
export class PendingActionTracker {
  private pending = new Map<string, PendingEntry>();

  constructor(
    private socket: SocketLike,
    private handlers: {
      /** re-applies a replayed action to the local store after a roomstate reset */
      redispatch: (action: Action) => void;
      /** called when an action is abandoned after repeated unconfirmed sends */
      onGiveUp: (action: Action) => void;
    },
  ) {}

  /** send an action to the server, tracking it until receipt is confirmed */
  send(action: Action) {
    const entry: PendingEntry = {
      message: { type: "action", action, id: nanoid() },
      attempts: 0,
    };
    this.pending.set(entry.message.id, entry);
    this.transmit(entry);
  }

  /** the server confirmed receipt of this action */
  handleAck(id: string) {
    const entry = this.pending.get(id);
    if (!entry) return;
    clearTimeout(entry.timer);
    this.pending.delete(id);
  }

  /**
   * A fresh roomstate arrived, overwriting local optimistic updates. Drop
   * pending actions the server reports as already applied (their effects are
   * baked into the new state) and replay the rest, both into the local store
   * and over the wire.
   */
  handleRoomstate(appliedActionIds: string[]) {
    const applied = new Set(appliedActionIds);
    for (const entry of Array.from(this.pending.values())) {
      clearTimeout(entry.timer);
      if (applied.has(entry.message.id)) {
        this.pending.delete(entry.message.id);
        continue;
      }
      entry.attempts = 0;
      this.handlers.redispatch(entry.message.action);
      this.transmit(entry);
    }
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
      this.handlers.onGiveUp(entry.message.action);
      return;
    }
    this.transmit(entry);
  }
}
