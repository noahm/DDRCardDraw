---
name: verify
description: Build, launch, and drive DDRCardDraw locally to verify changes at the browser surface.
---

# Verifying DDRCardDraw changes

## Build & launch

Two dev servers, both from the repo root (partykit needs `partykit.json` in cwd):

```bash
yarn install
npx partykit dev --port 1999   # websocket/state backend (event mode)
yarn start:frontend            # webpack dev server on :8080
```

Wait until `curl http://localhost:1999/parties/main/anyroom` returns 200 (partykit)
and `curl http://localhost:8080/` returns 200 (webpack; first build takes ~1-2 min).

## Drive

Playwright (chromium at `/opt/pw-browsers/chromium-*/chrome-linux/chrome` in remote
envs) against:

- `http://localhost:8080/classic` — classic mode, no backend needed.
- `http://localhost:8080/e/<any-room-name>` — event/tournament mode, backed by the
  partykit socket. Rooms are created on first visit.

Useful flows in event mode:

- Expand the cab panel: click the lone caret button in the 40px-wide left rail.
- Add a cab: fill `input[placeholder="Cab name"]`, press Enter — dispatches a
  redux action that round-trips through the partykit socket.
- Kill/restart `partykit dev` to exercise disconnect/reconnect handling
  (toasts appear via the app-root OverlayToaster).

## Gotchas

- `pkill -f 'partykit dev'` matches its own wrapping shell — use `pkill -f '[p]artykit dev'`.
- Dev `partykit dev` persists room state to disk, so room contents survive a backend restart.
- In dev, the frontend targets `localhost:1999` automatically (`src/party/host.ts`).
