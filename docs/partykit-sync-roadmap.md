# Event-mode sync: architecture roadmap

This documents the design plan for evolving the partykit-based sync behind
event mode (`/e/:roomName`) into something robust enough for flaky venue
wifi and concurrent editing, **without abandoning redux**. It was written
alongside PR #604 so the work can be picked up later from a fresh context.
For a guided tour of the implementation as it exists today, see
[partykit-sync-design.md](./partykit-sync-design.md).

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
  The server's store is authoritative; a full snapshot persists to room storage
  and, when configured, to a remote snapshot store (R2). See "Persistence" in
  [partykit-sync-design.md](./partykit-sync-design.md) for the current layout;
  the Supabase target described in earlier revisions of this document is gone.
- Wire protocol (`src/party/types.ts`):
  - client → server: `{type: "action", action, id}` — `id` is a unique
    message id (nanoid).
  - server → everyone (including sender): the same action stamped with a
    monotonic `seq`. The echo doubles as the receipt confirmation (ack).
  - server → sender only: `{type: "ack", id, ...}` when a duplicate re-send
    arrives for an already-applied id.
  - server → sender only: `{type: "reject", id, reason}` when the reducer
    threw. The server applies an action _before_ stamping and broadcasting it,
    so the echo only ever promises something that actually applied; a throwing
    action consumes no seq, never enters the tail or `recentActionIds`, and is
    rolled back on the sender instead of silently diverging the room.
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
  - A `seq` gap means a missed broadcast; the repair is an incremental
    catch-up (`{type:"catchup", since}` → the missing stamped actions),
    falling back to `socket.reconnect()` → fresh roomstate only when the gap
    predates the server's tail or catch-up goes unanswered (step 2).
  - On roomstate: pending ids listed in `recentActionIds` are dropped (their
    effects are baked into the snapshot); the rest are rebased and re-sent.
- Connection health: dispatch is gated off (`partyGateMiddleware`) from
  socket-close until the post-reconnect roomstate is fully applied; users see
  disconnect / blocked / reconnected toasts (suppressed in OBS sources). An
  application-level heartbeat (`ping`/`pong`) forces a reconnect when a socket
  stalls while still open (step 2).

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

### Step 2 — incremental catch-up + heartbeat ✅

- Server keeps an in-memory tail of the last 500 stamped actions. The client
  sends `{type: "catchup", since: seq}` on a detected gap; the server replies
  with the missing stamped actions (or a full roomstate if the tail doesn't
  reach back far enough). Replaces reconnect-as-only-repair; makes brief drops
  nearly free. The client buffers live broadcasts while a catch-up is in
  flight and drains them once the gap closes.
  - **The tail is memory-only, not in room storage** (the original plan said
    storage). A client can only observe a live-socket gap while the same actor
    has been running the whole time, so the in-memory tail is always intact for
    the case catch-up serves; a restart/hibernation drops every socket and
    clients take a fresh roomstate anyway. Persisting the full action bodies on
    every write would be the write-amplification step 3 is trying to _remove_.
- Application-level heartbeat: the client pings every ~10s and treats 2 missed
  pongs as a dead connection, forcing the reconnect flow. A stalled-but-open
  socket (server frozen, half-open TCP) is otherwise not noticed until an ack
  timeout — verified with SIGSTOP on workerd, see
  `.claude/skills/verify/SKILL.md`.
- `seq` and the dedupe id set persist alongside the state so PartyKit
  hibernation or a server restart can't reset `seq` to 0 or forget applied ids
  — closing the dedupe-across-hibernation hole. (The tail, being memory-only,
  is not part of this blob.) These began as a separate `syncMeta` key and were
  folded into a single atomic snapshot value in step 6; see there for why.

### Step 3 — event-sourcing lite

- Persist the stamped action log + periodic snapshots as the durable format.
  Supabase gets snapshot + tail instead of a full-state upsert on every
  action (current write amplification is significant).
- Tag log entries with app version; snapshot on version bump so old actions
  never replay through new reducers (`applyMigrations` stays snapshot-only).
- Unlocks: undo, audit ("who deleted that drawing"), time-travel debugging.
- Add `{type: "hello", protocolVersion}` handshake; server can tell outdated
  clients to refresh via the existing update-manager flow.
- **Durability signal — done, ahead of the rest of this step (step 6).** It
  was the one bullet here that mattered during an incident, so it shipped on
  its own rather than waiting for the log format.

Note that the Supabase half of this step is obsolete: that project is gone
(step 6). The action log and version tagging still stand, but they land in
whatever store step 6 settles on.

### Step 4 — trust boundary

- Server currently dispatches whatever clients send. Notably a forged
  `party/supplyState` action would overwrite the whole room via the root
  reducer's state-replacement branch. Whitelist allowed action types
  server-side. The `reject` message is already in place to carry the refusal
  back to the sender, so this step only needs the policy, not new protocol.
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

### Step 6 — get out from under the 128KiB ceiling ✅ (part 1)

Written after an event lost a dozen-plus draws to a partykit deploy. Worth
reading before touching persistence, because the cause was not the thing it
looked like.

#### What happened

`this.room.storage.put("currentState", state)` began failing with
`RangeError: Values cannot be larger than 131072 bytes` once the room passed
~15 draws. Every write after that rejected. The write was fire-and-forget, so
nothing surfaced. A deploy evicted the actor, `onStart` loaded the last
snapshot that fit, and every connected client adopted it — event mode keeps no
localStorage copy, so there was nothing anywhere else.

Three things turned a size limit into permanent loss:

1. **Silence.** A write could fail with nothing to tell anyone. Hours passed.
2. **`storage || supabase` hydration.** Supabase was only consulted when
   storage came back _empty_, never when it was merely stale — so the copy
   without a size limit could not rescue the copy with one. (Moot in the event
   anyway: that Supabase project had been paused for over a year and cannot be
   resumed, so every upsert had been returning Cloudflare `1016` on every
   action for that whole time. A dependency that fails loudly and constantly
   is indistinguishable from background noise.)
3. **Split writes.** `syncMeta` (a few KB) kept landing after `currentState`
   (~170KB) started failing, so a restarted room came back knowing the `seq`
   and dedupe ids of actions whose effects it had lost. A client re-sending one
   got an `ack` and gave up; `recentActionIds` told it to drop the pending
   action outright. That is what made the loss unrecoverable rather than
   merely annoying.

Sizing, for calibration: a real 5-chart head-to-head draw serializes to about
9.4KB, because every `EligibleChart` embeds its whole `Song` and each pocket
pick embeds another. Note the ceiling applies to the **structured-clone**
payload, which ran ~94.6% of the JSON character count in production — so the
practical budget is around 138,400 `stateLen`, not 131,072.

#### Part 1 — done

- **gzip on room storage**, shipped first and on its own as the stop-gap: ~5.5x
  headroom for the price of `CompressionStream`, which the runtime provides. R2
  deliberately stays plain JSON, since it has no ceiling to relieve and a
  readable off-box copy is worth more during an incident.
- **One atomic snapshot.** State, `seq` and `seenIds` are a single
  `RoomSnapshot` under one storage key, so they can no longer disagree. A
  legacy `currentState` + `syncMeta` pair is read once and converted on the
  next write — in either shape, since the gzip change landed before this one
  and rooms upgrading from it have a compressed value under the old key.
- **Hydrate by `seq`, not by precedence.** `onStart` reads every durable copy
  and takes whichever is furthest along, rather than short-circuiting on the
  first that answers.
- **A remote snapshot store with no ceiling.** R2 via its S3-compatible
  endpoint, signed with `aws4fetch`, because PartyKit's hosted runtime cannot
  bind Cloudflare resources. Writes coalesce (`REMOTE_WRITE_INTERVAL_MS`) so a
  burst of actions costs one round trip. Unconfigured is a supported state:
  the room runs on storage alone and `?debug` says so.
- **The durability signal from step 3.** `{type: "persisted", seq, appliedSeq}`,
  throttled. Clients poll `SyncManager.durabilityLag` rather than reacting to
  arrivals, because the meaningful signal is the message that _stops coming_.
  A standing lag raises a danger toast naming the risk.
- **Supabase removed** from the party server. `PIU_TOURNEY_SUPABASE_*` is a
  different project and is untouched.

#### Part 2 — eject the runtime (not started)

The hosted PartyKit runtime cannot bind Cloudflare resources, and the
deploy-to-your-own-account path still lists bindings as unreleased. The
sanctioned successor is [`partyserver`](https://www.npmjs.com/package/partyserver),
now developed in the `cloudflare/partykit` monorepo, running on plain Workers.

- `routePartykitRequest` keeps the `/parties/:server/:name` URL shape, so
  `partysocket` and `partykitEndpoint()` are unaffected. Client-side this is
  one constant: `PARTYKIT_HOST` in `src/party/host.ts`.
- Server-side it is a rename pass: `extends Server` from `partyserver`,
  `this.room.id` → `this.name`, `this.room.storage` → `this.ctx.storage`,
  `this.room.broadcast` → `this.broadcast`, `onMessage(message, sender)` →
  `onMessage(connection, message)` (**the arguments swap**), `partykit.json` →
  `wrangler.jsonc` with explicit DO bindings and migrations, `process.env` →
  `this.env`. `onAlarm()` becomes available and is the natural home for a
  periodic offsite snapshot.
- **Register the class as `new_sqlite_classes`.** SQLite-backed DO storage has
  a 2MB value limit against the KV-backed 128KiB, and brings `ctx.storage.sql`
  — which is what makes step 3's action log a table of rows rather than
  another single value with another ceiling. Converting an existing class in
  place is not possible, so this must be decided at the same time as the eject,
  not after.
- **Existing room state does not come with you.** Current rooms live in
  PartyKit's Cloudflare account; ejecting means a new DO namespace in ours and
  every room starts empty. Export anything worth keeping via the plain `GET`
  before cutting over. This is the largest operational risk of the move, and
  it is not a code problem.
- Once bindings exist, `snapshot-store.ts` loses the signing and becomes
  `env.SNAPSHOTS.put(...)`. The object layout carries over unchanged, which is
  why part 1 was built against R2 rather than waiting.

Sequencing note: part 2 is a breaking infrastructure change, so it wants to
ride along with the `next.ddr.tools` → `ddr.tools` migration rather than
landing on its own.

#### Rules this leaves behind

- A durable write that can fail silently is not a durable write. Any new
  persistence target reports through `persisted` or it does not ship.
- State and sequencer metadata are written together or not at all.
- Never hydrate by source precedence. Compare `seq` and take the newest.
- Watch `storedBytes` in `?debug`, not `stateLen`: the limit applies to the
  bytes actually stored. Room size grows without bound and every backend has
  _some_ ceiling.
- Anything that inserts an `await` before a durable write has to serialize
  those writes, or two actions can land out of order and leave the older state
  durable. Both the local and remote write paths drain through one loop.

## File map

| Concern                             | File                                                         |
| ----------------------------------- | ------------------------------------------------------------ |
| Wire protocol types                 | `src/party/types.ts`                                         |
| Server (room actor)                 | `src/party/server.ts`                                        |
| Durable snapshot shape + R2 store   | `src/party/snapshot-store.ts`                                |
| Client socket manager (react)       | `src/party/client.tsx`                                       |
| Confirmed/pending sync manager      | `src/party/sync-manager.ts`                                  |
| Dispatch gate while disconnected    | `src/state/party-gate-middleware.ts`                         |
| Connection health flag (non-synced) | `src/party/connection-status.ts`                             |
| Full-state replacement action       | `receivePartyState` in `src/state/central.ts` + root reducer |
| Runtime verification recipe         | `.claude/skills/verify/SKILL.md`                             |
