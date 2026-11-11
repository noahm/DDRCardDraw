# Event API

For tools that want an event's raw data rather than a rendered [OBS source](obs.md) — a stream bot, a results spreadsheet, a custom overlay — the event server answers a few plain `GET` requests. There's nothing to sign in to; anyone with an event's id can read it, just like the event itself. Responses allow cross-origin requests, so they can be fetched from browser code on any site.

Every route needs the event's id, and the player route also needs a cab id. Both are in any OBS source URL you copy from the stream dashboard:

```
https://next.ddr.tools/e/x0al49meVHr97AHKScNRd/cab/default/source/p1-name
                         ^^^^^^ eventId ^^^^^^     ^cabId^
```

## Player name

```
GET https://live.ddr.tools/api/e/:eventId/cab/:cabId/player/:playerIndex
```

The name of one player in the match currently assigned to that cab, as plain text. `:playerIndex` counts from zero in the order players are listed on the match: `0` is P1, `1` is P2.

This is the name exactly as entered, with none of the score or pronoun extras the OBS player source can add.

When there's no name to give, the response is an empty `204 No Content` with an `x-empty-reason` header saying why:

| `x-empty-reason`   | meaning                                  |
| ------------------ | ---------------------------------------- |
| `no cab found`     | the event has no cab with that id        |
| `no drawing found` | the cab has no match assigned right now  |
| `no player found`  | the match has no player at that position |

## Draw history

```
GET https://live.ddr.tools/api/e/:eventId/draws
```

Every drawing in the event as a JSON array: each one's players, drawn charts, bans, protects, pocket picks and winners. The shape is the app's own internal state rather than a stable, versioned format, so expect it to grow new fields over time.

The same response is also served at `/api/e/:eventId`.

## Earlier addresses

These routes replace an earlier draft of this API that ran at `ddr-tools-raw-player-name.val.run` and `ddr-tools-full-draw-history.val.run`. Those addresses redirect here, keeping the rest of the path, so URLs already in use keep working. New setups should use `live.ddr.tools` directly.
