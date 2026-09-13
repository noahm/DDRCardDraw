This is where the partykit server is implemented. See: https://docs.partykit.io/reference/partyserver-api/

For how the sync protocol works, read
[`docs/partykit-sync-design.md`](../../docs/partykit-sync-design.md); for where
it's going, [`docs/partykit-sync-roadmap.md`](../../docs/partykit-sync-roadmap.md).

## Operating an event room

### Durability

Every applied action writes a `RoomSnapshot` to partykit room storage, gzipped,
and — when configured — to R2 as plain JSON. **Room storage rejects any value
over 131072 bytes**; compression buys roughly 5.5x headroom against that, and
R2 has no such limit at all. Watch `storedBytes` in `?debug` rather than
`stateLen`: the limit applies to the compressed bytes.

Set the credentials once, then deploy — `partykit env` changes only take effect
on the next deploy:

```bash
npx partykit env add R2_ACCOUNT_ID
npx partykit env add R2_BUCKET
npx partykit env add R2_ACCESS_KEY_ID
npx partykit env add R2_SECRET_ACCESS_KEY
npx partykit deploy
```

Use an R2 API token scoped to that one bucket. With any of them missing the
server logs which, runs on room storage alone, and reports it in `?debug`.

### Checking on a live room

```bash
# health: hydration source, per-target write tallies, durability lag, warnings
curl -s 'https://ddr-card-draw-party.noahm.partykit.dev/parties/main/<room>?debug' | jq

# the room's current state, straight from the actor's memory
curl -s 'https://ddr-card-draw-party.noahm.partykit.dev/parties/main/<room>' > room.json

# follow one room's diagnostic log
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
   `remote.put:error` lines in the tail to find which target is failing.
