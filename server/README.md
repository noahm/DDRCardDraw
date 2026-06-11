This is the self-hosted realtime backend that keeps a per-room copy of redux
state in sync between connected clients. It's a plain Node websocket server
(see `realtime-server.mts`) — no third-party hosting platform required.

Run it locally with `yarn start:backend` (alias for `node server/run.mjs`,
which bundles and runs `realtime-server.mts`). It listens on port 1999 by
default (override with `PORT`).

Each room's state is persisted to a JSON file under `.room-state/` so it
survives restarts. If `SUPABASE_URL` and `SUPABASE_KEY` are set in the
environment, state is also upserted to a `event_state` Supabase table as a
secondary backup (see `database.types.ts` for the expected schema).

## Asset uploads

Imported song packs (jackets/banners/backgrounds) are uploaded to the server
so they can be synced to every connected client:

- `POST /parties/main/<room>/assets` accepts a single image (`Content-Type`
  must be one of `image/jpeg`, `image/png`, `image/webp`, or `image/gif`, and
  the body must be 2MB or smaller) and returns `{ "url": "/parties/main/<room>/assets/<id>.<ext>" }`.
- `GET` on that returned URL serves the stored image.

Uploaded files are stored under `.room-state/<room>/assets/`. Clients resize
images before uploading, so the 2MB limit is mostly a safeguard.
