# Event-mode sync: architecture roadmap

This documents the design plan for evolving the partykit-based sync behind
event mode (`/e/:roomName`) into something robust enough for flaky venue
wifi and concurrent editing, **without abandoning redux**. It was written
alongside PR #604 so the work can be picked up later from a fresh context.
For a guided tour of the implementation as it exists today, see
[partykit-sync-design.md](./partykit-sync-design.md).

Two steps here are not strictly about the sync protocol but sit on its
critical path: **2.5** (where the server runs, and whether we can see what it
did after the fact) and **3.5** (how new client builds get delivered, once the
service worker is no longer earning its keep).

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
- Diagnostics (PR #611): the server emits structured `[party-diag]` lines
  stamped with `room=<id>`, `yarn watch:room` wraps `partykit tail` to digest
  one room's timeline, `GET ...?debug` returns a health snapshot, and event
  mode has a user-facing diagnostics panel that produces a shareable report.
  All of it is _live-only_ — see step 2.5 for what's missing.

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
- `seq` and the dedupe id set now persist to room storage (the `syncMeta` key,
  written alongside `currentState`) so PartyKit hibernation or a server restart
  can't reset `seq` to 0 or forget applied ids — closing the
  dedupe-across-hibernation hole. (The tail, being memory-only, is not part of
  this blob.)

### Step 2.5 — self-hosted deployment + durable observability

PR #611 gave the server a real diagnostic vocabulary, but nothing durable to
say it into. `partykit tail` is a live firehose with no backfill — as
`scripts/watch-room.mjs` says in its own header, anything logged during a gap
is gone. The practical failure mode: an event goes sideways on Saturday, the
report arrives Sunday, and the evidence never existed. Errors the server
already detects (`storage.put:fail`, `supabase.upsert:fail`, a reducer throw)
scroll past unwitnessed.

This is a hosting-platform limit, not a logging limit, so the fix is to move
the room actor onto our own Cloudflare account. Two doors:

- **Cloud-prem** — PartyKit's supported "deploy to your own Cloudflare
  account" mode. Keeps `src/party/server.ts` and the PartyKit CLI as-is, and
  is enough to unlock everything below. The cheap door.
- **Port to `partyserver` + wrangler** — the full-control endpoint. The
  mapping is mechanical for a server this size (`onStart`/`onConnect`/
  `onMessage`/`onRequest` carry over, `room.storage` → `this.ctx.storage`,
  `room.broadcast` → `this.broadcast`); the new work is hand-writing the
  `durable_objects.bindings` and migration tags that PartyKit infers today.

What that buys, mapped to the gap:

- **Workers Logs** — retained, queryable invocation logs (currently ~7 days on
  the Workers Paid plan). Turns `watch:room` from "you had to be tailing at
  the time" into "query `room=<id>` after the event."
- **Logpush → R2** for retention past that window, if a whole season should be
  keepable.
- **Tail Workers** — a worker that receives another worker's logs _and
  uncaught exceptions_ programmatically. This is the piece that answers
  "errors disappear": route persistence failures and reducer throws to Discord
  or Sentry as they happen, instead of hoping someone was watching.
- **Workers Analytics Engine** — cheap high-cardinality counters written from
  inside the room. Rejects, catch-up rounds, tail-overflow-to-roomstate
  events, and persisted-seq lag (step 3) become time series rather than grep
  results.
- Incidentally: our own DO namespace also means alarms, SQLite-backed DO
  storage, a real staging environment, and versioned deploys with rollback.

**Why this lands before step 3, not after:**

1. Step 3 rewrites persistence, and self-hosting changes what it gets
   rewritten _onto_ — an action log against DO SQLite or R2 snapshots is a
   different design than Supabase upserts. Do step 3 first and the durable
   format gets designed twice.
2. Step 3's `{type:"persisted", seq}` is the client half of exactly this
   concern. The server half — did the write land, and can that be seen an hour
   later — needs retained logs and alerting. One feature, two layers; building
   the client half while the server half logs into the void is the weaker
   order.
3. **Migration is cheapest right now.** Today durable truth is a full-state
   snapshot, and `onStart` already falls back room storage → Supabase → fresh.
   _That fallback is the migration mechanism_: a fresh DO namespace hydrates
   each room from Supabase on first connect, with no export tooling. After
   step 3, durable truth is a version-tagged action log living in DO storage,
   and this becomes an actual data migration.
4. It neither blocks nor overlaps step 4 — the trust boundary is pure
   application policy either way.

**Caveats to plan around:**

- Room storage in the managed account does **not** transfer. Supabase is the
  only carry-over, so anything newer than its last upsert — and any room where
  `SUPABASE_URL`/`SUPABASE_KEY` weren't configured — is lost. Migrate between
  events, never during one, and confirm credentials are live first.
- The host changes in `src/party/host.ts`, which is compiled into the client
  bundle, so a client running a stale cached bundle keeps talking to the old
  backend (see step 3.5). Keep the managed deployment serving through the
  transition, or move DNS rather than the hostname.
- Cloudflare's automatic tracing does not span Durable Object invocation
  boundaries, so per-room correlation stays our job — which is what the
  `room=<id>` stamp on every diagnostic line already does.
- Most of the above is Workers Paid, and retention/plan details move; re-check
  current limits before committing to a retention story.

### Step 3 — event-sourcing lite

- Persist the stamped action log + periodic snapshots as the durable format.
  Supabase gets snapshot + tail instead of a full-state upsert on every
  action (current write amplification is significant).
- Tag log entries with app version; snapshot on version bump so old actions
  never replay through new reducers (`applyMigrations` stays snapshot-only).
- Unlocks: undo, audit ("who deleted that drawing"), time-travel debugging.
- Add `{type: "hello", protocolVersion}` handshake; server can tell outdated
  clients to refresh via the existing update-manager flow. Note that flow is
  built on `@lcdp/offline-plugin`, which step 3.5 proposes retiring — this
  handshake is the event-mode half of its replacement.
- **Durability signal (not yet implemented).** `reject` closes the gap for
  actions the reducer refuses, but an action that applies cleanly and then
  fails to _persist_ is still confirmed to the client with nothing to take it
  back: `storage.put` is fire-and-forget and the Supabase upsert's error is
  returned rather than thrown. A `{type:"persisted", seq}` emitted once a write
  settles would let clients see how far the durable snapshot has actually
  advanced and surface a warning when it stalls behind the applied seq — the
  failure mode where edits look fine until a reconnect reverts everyone to an
  old checkpoint. Worth folding into this step, since it reworks persistence
  anyway.

### Step 3.5 — retire the service worker

Not a sync-protocol step, but it belongs on this timeline: the app has evolved
toward being fully online, and the offline layer now costs more than it pays.
Sequenced after step 3 because that step's `hello` handshake supplies half the
replacement; it can move earlier if the maintenance burden bites first.

**What's actually there today.** `@lcdp/offline-plugin` 5.1.1 (a maintenance
fork of the abandoned webpack-4-era `offline-plugin`) is configured in
`webpack.config.js` for production builds only, with
`responseStrategy: "network-first"`, `autoUpdate: true`, and
`excludes: ["../*.zip", "jackets/**/*", "favicons/*"]`. Renovate already has
it pinned with `"enabled": false` — we treat it as frozen. Being network-first,
it is not a speed layer; it is a fallback cache plus an update transport.

**Three separate things are bundled together here, and they should be
untangled before anything is deleted:**

1. _Offline caching_, which is already only half-true. Song data chunks are
   precached, but jackets are explicitly excluded — so an offline card draw
   renders with whatever art the ordinary HTTP cache happens to still hold.
   Meanwhile event mode needs a websocket, preview mode needs an HTTP
   snapshot, and start.gg import needs the network. Classic mode is the only
   genuinely offline-capable mode.
2. _Update delivery_, which is the load-bearing part. `UpdateManager`
   (`src/update-manager.tsx`, mounted in `src/app.tsx`) is entirely
   `OfflinePluginRuntime.install()` — `onUpdateReady`/`onUpdated` drive the
   "new version, reload?" toast and the silent auto-reload in OBS sources.
   **This is what has to be replaced; the caching is what can simply go.**
3. _PWA installability_. `docs/readme.md` promises both offline use and "add
   to home page." Installability has historically required a service worker
   with a fetch handler — verify current Chrome and Safari criteria before
   committing, since this is the claim most likely to actually regress.

**The offline story that survives regardless** is `yarn build:zip`: a
standalone copy that runs entirely offline, jackets and all, from `index.html`
— and it already excludes `__offline_serviceworker`. That, not the service
worker, is the real answer for a venue with no wifi.

**Retirement needs a tombstone, not a deletion.** A registered service worker
keeps controlling the page until something replaces it, so dropping the plugin
from the build would strand every existing visitor on a cached bundle
indefinitely — including, per step 2.5, one pointed at the old backend host.
The repo already contains the pattern: `surge-redirect/sw.js` registers, calls
`skipWaiting()`, and unregisters itself. Ship that at the same scope, and keep
it deployed for a long time.

Sketch of the order:

1. Replace update delivery. Event mode gets it from step 3's `hello`
   handshake; classic mode needs a lightweight build-id poll (fetch a version
   file, compare against the bundled id, show the same toast).
   `UpdateManager`'s UI and OBS special-casing stay — only its transport
   changes.
2. Ship the self-unregistering service worker in place of the generated one.
3. Drop `@lcdp/offline-plugin` from `webpack.config.js`, `package.json`, and
   the `renovate.json` exception.
4. Update `docs/readme.md`, which currently promises offline use and
   installability, and point the offline use case at `build:zip`.

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

## File map

| Concern                             | File                                                           |
| ----------------------------------- | -------------------------------------------------------------- |
| Wire protocol types                 | `src/party/types.ts`                                           |
| Server (room actor)                 | `src/party/server.ts`                                          |
| Client socket manager (react)       | `src/party/client.tsx`                                         |
| Confirmed/pending sync manager      | `src/party/sync-manager.ts`                                    |
| Dispatch gate while disconnected    | `src/state/party-gate-middleware.ts`                           |
| Connection health flag (non-synced) | `src/party/connection-status.ts`                               |
| Full-state replacement action       | `receivePartyState` in `src/state/central.ts` + root reducer   |
| Runtime verification recipe         | `.claude/skills/verify/SKILL.md`                               |
| Client diagnostics report + panel   | `src/party/diagnostics.ts`, `src/party/diagnostics-dialog.tsx` |
| Per-room log tailing                | `scripts/watch-room.mjs` (`yarn watch:room`)                   |
| Deployment config (step 2.5)        | `partykit.json`                                                |
| Service worker + update flow        | `webpack.config.js` (OfflinePlugin), `src/update-manager.tsx`  |
