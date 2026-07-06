# Event-mode sync: architecture roadmap

This documents the design plan for evolving the partykit-based sync behind
event mode (`/e/:roomName`) into something robust enough for flaky venue
wifi and concurrent editing, **without abandoning redux**. It was written
alongside PR #604 so the work can be picked up later from a fresh context.

## Where this is going, in one paragraph

Redux is a state machine, and PartyKit gives every room a single always-online
actor. That combination is the textbook setup for a **replicated state machine
with a central sequencer**: clients send actions as _proposals_, the server
orders them (assigning a monotonic `seq`), and every replica — including the
proposer — builds its confirmed state exclusively from server-ordered actions.
Local responsiveness comes from an optimistic "pending" layer rebased on top.
This gets convergence, offline detection, and incremental recovery while
keeping plain-JSON state, ordinary reducers, and centrally-enforced
invariants. CRDTs are deliberately **not** on this path (see last section).

## Current architecture (as of PR #604)

- Client and server run the same reducer bundle (`src/state/root-reducer.ts`).
  The server's store is authoritative; full snapshots persist to room storage
  and Supabase.
- Wire protocol (`src/party/types.ts`):
  - client → server: `{type: "action", action, id}` — `id` is a unique
    message id (nanoid).
  - server → everyone (including sender): the same action stamped with a
    monotonic `seq`. The echo doubles as the receipt confirmation (ack).
  - server → sender only: `{type: "ack", id, ...}` when a duplicate re-send
    arrives for an already-applied id.
  - server → client on connect: `{type: "roomstate", state, seq,
recentActionIds}`.
- Client-side `SyncManager` (`src/party/sync-manager.ts`) maintains the core
  invariant: **display state == confirmed state + pending actions replayed in
  order**.
  - _confirmed_: built only from seq-stamped actions, applied in seq order.
  - _pending_: locally-dispatched actions not yet confirmed; re-sent every 5s
    (server dedupes by id), abandoned after 4 attempts with a toast + local
    rollback (rebase without the abandoned action).
  - A foreign action arriving while pending actions exist triggers a rebase:
    recompute display = confirmed + pending, delivered via
    `receivePartyState` (wholesale state replacement in the root reducer).
  - A `seq` gap means a missed broadcast; the only repair today is
    `socket.reconnect()` → fresh roomstate (see step 2 for the cheaper fix).
  - On roomstate: pending ids listed in `recentActionIds` are dropped (their
    effects are baked into the snapshot); the rest are rebased and re-sent.
- Connection health: dispatch is gated off (`partyGateMiddleware`) from
  socket-close until the post-reconnect roomstate is fully applied; users see
  disconnect / blocked / reconnected toasts (suppressed in OBS sources).

### Hard requirement: deterministic reducers

Replication by action replay only converges if the same action produces the
same state everywhere. **No `nanoid()`, `Math.random()`, or `Date.now()`
inside reducers** — generate ids/timestamps in `prepare` callbacks or thunks
so they ride in the action payload. `event/addCab` violated this (id minted
in the reducer, so the sender's cab id never matched the server's) and was
fixed in PR #604. Audit any new reducer for this.

### Version compatibility rules

- Old (pre-#604) clients send actions without `id`. The server relays those
  the old way (broadcast excluding sender, no echo, no stamp) so they don't
  double-apply their own actions. New clients apply un-stamped foreign
  actions to both confirmed and display (server broadcast order is still
  canonical), skipping seq checks.
- A new client on an old server (no `seq` in roomstate) degrades to the
  pre-#604 behavior: optimistic apply + ack-based pending tracking, no
  rebasing, no give-up rollback (`lastSeq == null` guards these).
- **Deploy the partykit server before the web app** whenever the protocol
  grows.

## Roadmap

### Step 1 — server sequencing + confirmed/pending split ✅ (PR #604)

Described above. Kills the divergence class caused by clients applying
concurrent actions in different orders.

### Step 2 — incremental catch-up + heartbeat (next)

- Server keeps a tail of recent stamped actions (say 500) in room storage.
  Client sends `{type: "catchup", since: seq}` on a detected gap; server
  replies with the missing stamped actions (or a full roomstate if the tail
  doesn't reach back far enough). Replaces reconnect-as-only-repair; makes
  brief drops nearly free.
- Application-level heartbeat: client pings every ~10s, treats N missed pongs
  as a dead connection and forces the reconnect flow. Today a
  stalled-but-open socket (server frozen, half-open TCP) isn't noticed until
  an ack timeout — verified with SIGSTOP on workerd, see
  `.claude/skills/verify/SKILL.md`.
- Move `seq` and the dedupe id set into room storage so PartyKit hibernation
  or a server restart can't reset them (today: in-memory; safe only because a
  restart drops all sockets, forcing full roomstate resyncs; the dedupe
  window across hibernation is a known small hole).

### Step 3 — event-sourcing lite

- Persist the stamped action log + periodic snapshots as the durable format.
  Supabase gets snapshot + tail instead of a full-state upsert on every
  action (current write amplification is significant).
- Tag log entries with app version; snapshot on version bump so old actions
  never replay through new reducers (`applyMigrations` stays snapshot-only).
- Unlocks: undo, audit ("who deleted that drawing"), time-travel debugging.
- Add `{type: "hello", protocolVersion}` handshake; server can tell outdated
  clients to refresh via the existing update-manager flow.

### Step 4 — trust boundary

- Server currently dispatches whatever clients send. Notably a forged
  `party/supplyState` action would overwrite the whole room via the root
  reducer's state-replacement branch. Whitelist allowed action types
  server-side.
- Room secret / role tokens: organizer (write) vs viewer + OBS sources
  (read-only).

### Step 5 (only if requirements change) — scoped CRDTs

Full-CRDT (automerge/yjs for the whole state) is deliberately rejected:

- PartyKit already provides the central authority CRDTs exist to avoid
  needing; the sequencer gets convergence with none of the CRDT costs.
- Costs avoided: rewriting redux slices as CRDT docs, tombstone growth,
  losing plain-JSON state, and — decisive — invariants like "one active
  match per cab" being unenforceable under merge semantics. The reducer
  stays the single place business rules live.
- MQTT for comparison: its useful ideas are already absorbed — the ack/dedupe
  work is QoS-1 + idempotency (effectively exactly-once application),
  roomstate-on-connect is a retained message, step 2's catch-up is session
  resumption. An external broker would add ops burden without solving
  ordering or merge.

If true offline editing ever becomes a requirement, scope a CRDT to the one
subtree that wants it (e.g. collaborative text editing of `obsCss` via yjs
running through its own channel), not the whole state. Queued-intent replay
(the pending layer) already covers short offline windows.

## File map

| Concern                             | File                                                         |
| ----------------------------------- | ------------------------------------------------------------ |
| Wire protocol types                 | `src/party/types.ts`                                         |
| Server (room actor)                 | `src/party/server.ts`                                        |
| Client socket manager (react)       | `src/party/client.tsx`                                       |
| Confirmed/pending sync manager      | `src/party/sync-manager.ts`                                  |
| Dispatch gate while disconnected    | `src/state/party-gate-middleware.ts`                         |
| Connection health flag (non-synced) | `src/party/connection-status.ts`                             |
| Full-state replacement action       | `receivePartyState` in `src/state/central.ts` + root reducer |
| Runtime verification recipe         | `.claude/skills/verify/SKILL.md`                             |
