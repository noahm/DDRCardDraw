---
name: verify
description: Build, launch, and drive DDRCardDraw locally to verify changes at the browser surface.
---

# Verifying DDRCardDraw changes

## Build & launch

Two dev servers, both from the repo root (wrangler needs `wrangler.jsonc` in cwd):

```bash
yarn install
yarn start:backend             # wrangler dev on :1999, websocket/state backend (event mode)
yarn start:frontend            # webpack dev server on :8080
```

Wait until `curl http://localhost:1999/parties/main/anyroom` returns 200 (wrangler)
and `curl http://localhost:8080/` returns 200 (webpack; first build takes ~1-2 min).

## Drive

Playwright (chromium at `/opt/pw-browsers/chromium-*/chrome-linux/chrome` in remote
envs) against:

- `http://localhost:8080/classic` — classic mode, no backend needed.
- `http://localhost:8080/e/<any-room-name>` — event/tournament mode, backed by the
  party socket (a Durable Object per room). Rooms are created on first visit.

Useful flows in event mode:

- Expand the cab panel: click the lone caret button in the 40px-wide left rail.
- Add a cab: fill `input[placeholder="Cab name"]`, press Enter — dispatches a
  redux action that round-trips through the party socket.
- Kill/restart `wrangler dev` to exercise disconnect/reconnect handling
  (toasts appear via the app-root OverlayToaster).

## Gotchas

- `pkill -f 'wrangler dev'` matches its own wrapping shell — use `pkill -f '[w]rangler dev'`.
- `wrangler dev` spawns a `workerd` child that actually owns the websockets. To
  simulate a stalled/dead server, signal `'[w]orkerd serve'` (SIGSTOP freezes it
  without closing sockets — great for ack-timeout tests). Playwright's
  `page.on("websocket")` frame events give protocol-level evidence.
- `wrangler dev` persists Durable Object storage and the simulated `SNAPSHOTS` R2
  bucket under `.wrangler/state`, so room contents survive a backend restart.
- To exercise hydration from the off-box copy, put a snapshot into the local
  bucket for a room that has never been visited:
  `yarn wrangler r2 object put ddr-tools-persistence/rooms/<room>/snapshot.json --file snap.json --local`,
  then check `curl 'localhost:1999/parties/main/<room>?debug' | jq .hydration` says `remote`.
- `GET /parties/main/<room>?debug` reports hydration source, write tallies and warnings.
- In dev, the frontend targets `localhost:1999` automatically (`PARTY_HOST` in `webpack.config.js`).
