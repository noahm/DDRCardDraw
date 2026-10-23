This is where the event-mode sync server is implemented: a Durable Object
class (`Main`, in `server.ts`) on Cloudflare Workers, routed by
[`partyserver`](https://github.com/cloudflare/partykit/tree/main/packages/partyserver)
from `worker.ts`. Bindings live in [`wrangler.jsonc`](../../wrangler.jsonc).
It ran on hosted PartyKit until that service was taken offline.

For how the sync protocol works, read
[`docs/partykit-sync-design.md`](../../docs/partykit-sync-design.md); for where
it's going, [`docs/partykit-sync-roadmap.md`](../../docs/partykit-sync-roadmap.md).

## Running and deploying

```bash
yarn start:backend   # wrangler dev on :1999, what the dev frontend connects to
yarn deploy:party    # wrangler deploy, served at live.ddr.tools
```

Deploy the server before the web app whenever the protocol changes. The web
app's target host is baked in at build time as `PARTY_HOST` (see
`webpack.config.js`); set that env var to point a build somewhere else.

## Operating an event room

### Durability

Every applied action writes a `RoomSnapshot` to the room's Durable Object
storage, gzipped, and — coalesced to one write every couple of seconds — to the
R2 bucket bound as `SNAPSHOTS`, as plain JSON at
`rooms/<room>/snapshot.json`. Storage is SQLite-backed, which caps a value at
2 MB; R2 has no such limit. Watch `storedBytes` in `?debug` rather than
`stateLen`: the limit applies to the compressed bytes.

A room hydrates from whichever copy has the higher `seq`. That is how rooms
from the hosted-PartyKit era come back: their old room storage is gone, but
any room that had been written to R2 starts from that snapshot the first time
it is visited.

No secrets are involved; the binding is the credential. `wrangler dev`
simulates both storage and the bucket under `.wrangler/state` (gitignored), so
local development exercises the same code path:

```bash
yarn wrangler r2 object get ddr-tools-persistence/rooms/<room>/snapshot.json --local --pipe | jq .seq
rm -rf .wrangler/state                         # start every local room over
```

Seeding a local room from a production snapshot is a one-line rehearsal of the
R2 hydration path: `get` it without `--local`, then `put` it with `--local`.

### Checking on a live room

```bash
# health: hydration source, per-target write tallies, durability lag, warnings
curl -s 'https://live.ddr.tools/parties/main/<room>?debug' | jq

# the room's current state, straight from the actor's memory
curl -s 'https://live.ddr.tools/parties/main/<room>' > room.json

# follow one room's diagnostic log (wraps `wrangler tail`)
yarn watch:room <room>          # accepts a room id or a full /e/ URL
```

Two things to know about `?debug`: requesting it **instantiates the room if it
was evicted**, so the write counters describe the instance you just woke rather
than the one that died — the snapshot comparison is the part that survives. And
`durabilityLag` is the number to watch: anything standing above zero means
applied actions are not saved and a restart would lose them.

### If a room is not saving

1. Don't deploy. A restart is what turns "not saving" into "data lost".
2. `curl` the plain `GET` to a file, on a loop. It serves the actor's memory and
   is the only copy of anything unsaved.
3. Read the `warnings` array in `?debug` and the `storage.put:error` /
   `remote.put:error` lines in the tail (or the Workers dashboard's logs, since
   observability is enabled) to find which target is failing.
