import { getServerByName } from "partyserver";
import type { Drawing } from "../models/Drawing";
import type { AppState } from "../state/store";

/**
 * Plain GET endpoints for reading an event room from outside the app, e.g. as
 * OBS text sources or for exporting results. These replace the old
 * `ddr-tools-*.val.run` proxies, which fetched `/parties/main/<room>` and
 * projected it; here we ask the room's Durable Object directly instead.
 *
 * - `/api/e/:eventId/cab/:cabId/player/:playerIndex` → the raw name of the
 *   player at that 0-based position in the cab's active match, as plain text
 * - `/api/e/:eventId/draws` → every drawing in the event, as JSON. Also
 *   answers at bare `/api/e/:eventId`, the path the old full-draw-history
 *   proxy used, so its val.run redirect lands here unchanged.
 *
 * Documented for users in docs/api.md.
 */
const PLAYER_NAME = new URLPattern({
  pathname: "/api/e/:eventId/cab/:cabId/player/:playerIndex",
});
const DRAWS = new URLPattern({ pathname: "/api/e/:eventId{/draws}?" });

const CORS_HEADERS = { "Access-Control-Allow-Origin": "*" };

/** returns null when the request isn't for one of these routes */
export async function routeApiRequest(
  request: Request,
  env: Env,
): Promise<Response | null> {
  const url = new URL(request.url);
  if (!url.pathname.startsWith("/api/")) return null;
  if (request.method !== "GET") {
    return new Response("Method not allowed", {
      status: 405,
      headers: CORS_HEADERS,
    });
  }

  const playerMatch = PLAYER_NAME.exec(url);
  if (playerMatch) {
    const { eventId, cabId, playerIndex } = playerMatch.pathname.groups;
    const state = await getRoomState(env, eventId!);
    return playerNameResponse(state, cabId!, +playerIndex!);
  }

  const drawsMatch = DRAWS.exec(url);
  if (drawsMatch) {
    const state = await getRoomState(env, drawsMatch.pathname.groups.eventId!);
    return Response.json(Object.values(state.drawings.entities), {
      headers: CORS_HEADERS,
    });
  }

  return new Response("Not found", { status: 404, headers: CORS_HEADERS });
}

/** the same state `GET /parties/main/<room>` serves */
async function getRoomState(env: Env, eventId: string): Promise<AppState> {
  const stub = await getServerByName(env.Main, eventId);
  const resp = await stub.fetch(
    `https://room/parties/main/${encodeURIComponent(eventId)}`,
  );
  return resp.json();
}

/** an empty 204 with the reason in a header, as the old val.run proxy sent */
function empty(reason: string) {
  return new Response(null, {
    status: 204,
    headers: { ...CORS_HEADERS, "x-empty-reason": reason },
  });
}

function playerNameResponse(
  state: AppState,
  cabId: string,
  playerIndex: number,
): Response {
  const cab = state.event.cabs[cabId];
  if (!cab) return empty("no cab found");
  // a sub draw is addressed as [parentId, subDrawId]; players live on the parent
  const drawingId = Array.isArray(cab.activeMatch)
    ? cab.activeMatch[0]
    : cab.activeMatch;
  const drawing: Drawing | undefined =
    drawingId == null ? undefined : state.drawings.entities[drawingId];
  if (!drawing) return empty("no drawing found");
  const player = drawing.meta.players[playerIndex];
  if (!player) return empty("no player found");
  return new Response(player.name || "", {
    headers: { ...CORS_HEADERS, "Content-Type": "text/plain" },
  });
}
