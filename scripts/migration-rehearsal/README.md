# Step 2.5 migration rehearsal

A prototype that tests the migration path claimed in
[docs/partykit-sync-roadmap.md](../../docs/partykit-sync-roadmap.md) step 2.5:

> Today durable truth is a full-state snapshot, and `onStart` already falls
> back room storage → Supabase → fresh. _That fallback is the migration
> mechanism_: a fresh DO namespace hydrates each room from Supabase on first
> connect, with no export tooling.

If that holds, moving off managed PartyKit is a redeploy rather than a data
migration. This harness checks whether it actually holds, before we bet an
event on it.

```sh
node scripts/migration-rehearsal/rehearse.mjs           # ~3 minutes
node scripts/migration-rehearsal/rehearse.mjs --verbose # stream child output
node scripts/migration-rehearsal/rehearse.mjs --keep    # keep .rehearsal/ dirs
```

## How it works

Two real party deployments run the unmodified `src/party/server.ts` against one
shared backend, with **different `--persist` directories**:

|              | role                                    | room storage               |
| ------------ | --------------------------------------- | -------------------------- |
| deployment A | the managed deployment we are leaving   | populated by the rehearsal |
| deployment B | the self-hosted deployment we move to   | empty                      |
| deployment C | a cutover that happens during an outage | empty                      |

`shared-backend.mjs` stands in for Supabase, speaking the PostgREST subset the
server uses (verified against `@supabase/postgrest-js` in `node_modules`). It is
a stand-in rather than a real project because the claim under test is about
_our_ hydration behaviour, not about Supabase — and this way the rehearsal needs
no credentials and can inject failures on demand.

The rehearsal drives real websockets with real redux actions (`event/addCab`),
then cuts A off and asks B to pick the room up.

Two notes on wiring, both of which cost a debugging round:

- The server reads `process.env.SUPABASE_*` at module scope, so PartyKit's
  `--var` (which populates `room.env`) does **not** reach it. The rehearsal uses
  `--define` to substitute the values at build time instead. It deliberately
  does not write a `.env`, which would clobber a developer's real credentials.
- `partykit dev` spawns a `workerd` child that owns the port, and killing only
  the node wrapper leaves it serving. A survivor answers readiness checks and
  `?debug` perfectly well while wired to a _different_ backend — so the harness
  pre-flights every port and then requires the responding server to have logged
  its own startup before trusting it.

## Results

Last run: 9/10 checks pass. **The migration path works. The way it fails does
not.**

### The claim holds

- Deployment B recovered the room with no room storage of its own, hydrating
  from the shared backend alone (`onStart source=supabase`).
- B's state came back **byte-identical** to A's.
- Hydration is keyed by room id — a room the backend never saw starts fresh
  rather than inheriting anything.

So the roadmap's core assertion is confirmed: point a new deployment at the same
Supabase project and rooms come back on first connect.

### What does not come across

`syncMeta` (the sequencer position and dedupe set) lives **only in room
storage**, never in Supabase. After migration:

- `seq` restarts at 0 (A ended at 3). Harmless on its own — clients adopt the
  new roomstate wholesale.
- `recentActionIds` is empty, so **the dedupe set does not survive the move**. A
  client that reconnects with a pending action re-sends it, and the new
  deployment applies it a second time even though its effect is already baked
  into the snapshot it just hydrated.

The rehearsal confirms the re-send is accepted and re-applied. It happened to be
harmless there because `event/addCab` writes to a payload-keyed slot — but
`drawings/addOneChart` does an unkeyed `charts.push()`, and that one duplicates.

**Mitigation:** migrate between events, when no client holds pending actions.
The roadmap already says this; the rehearsal shows exactly why it matters and
which actions would corrupt.

### The one that needs fixing first

> ❌ `a room that failed to hydrate does not overwrite the stored snapshot`

**This check is expected to fail until a guard exists.** It is not a broken
harness — it is the finding.

When the shared backend is unreadable at startup, `onStart` catches the error,
logs it, and carries on with a **fresh, empty store**. The room then serves that
empty state to clients as though it were real. And the first action dispatched
into it triggers the normal upsert, which writes the blank state back over the
good row.

Measured: stored cabs went `[Primary Cab, Rehearsal Cab 1, Rehearsal Cab 2,
Rehearsal Cab 3]` → `[Cab From Blank Room, Primary Cab]`. The event's state was
destroyed in the one place that was supposed to be the safety net, and nothing
in the system objected.

This matters far more during a migration than in steady state. Normally room
storage answers first and a Supabase blip is invisible. But **at cutover every
room has empty storage by definition**, so every room depends entirely on that
one read succeeding. A transient failure during the cutover window doesn't just
fail to migrate a room — it deletes it. A paused free-tier Supabase project
would produce exactly this.

The read failure _is_ already visible in `?debug` (`hydration.error`) and in the
logs — observability is not the gap. The gap is that nothing acts on it.

Suggested guard, in rough order of preference:

1. If hydration was attempted and **errored**, refuse to persist. Serve the room
   read-only, surface it loudly, and let a human decide. An empty room that
   cannot overwrite anything is recoverable; one that can is not.
2. Distinguish "backend returned no row" (a genuinely new room, safe to start
   fresh) from "backend could not be reached" (unknown, unsafe). `onStart`
   currently collapses both into `source: "fresh"`.
3. Take a pre-cutover backup of the `event_state` table regardless, so this is
   survivable even if the guard has a hole.

## Files

|                      |                                                           |
| -------------------- | --------------------------------------------------------- |
| `rehearse.mjs`       | the driver: boots everything, drives the sockets, reports |
| `shared-backend.mjs` | PostgREST-shaped stand-in for the `event_state` table     |

Scratch directories land in `.rehearsal/` (gitignored) and are wiped on each run
unless `--keep` is passed.
