This is the self-hosted realtime backend that keeps a per-room copy of redux
state in sync between connected clients. It's a plain Node websocket server
(see `realtime-server.mts`) — no third-party hosting platform required.

Run it locally with `yarn start:backend` (alias for
`node --experimental-strip-types server/realtime-server.mts`). It listens on
port 1999 by default (override with `PORT`).

Each room's state is persisted to a JSON file under `.room-state/` so it
survives restarts. If `SUPABASE_URL` and `SUPABASE_KEY` are set in the
environment, state is also upserted to a `event_state` Supabase table as a
secondary backup (see `database.types.ts` for the expected schema).
