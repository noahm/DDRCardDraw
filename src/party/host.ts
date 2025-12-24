import type { AppState } from "../state/root-reducer";

export const PARTYKIT_HOST =
  process.env.NODE_ENV === "development"
    ? "localhost:1999"
    : "ddr-card-draw-party.noahm.partykit.dev";

const ENDPOINT_PROTOCOL =
  process.env.NODE_ENV === "development" ? "http" : "https";

export function partykitEndpoint(roomName: string) {
  return `${ENDPOINT_PROTOCOL}://${PARTYKIT_HOST}/parties/main/${roomName}`;
}

export async function getPartykitState(roomName: string): Promise<AppState> {
  const req = await fetch(partykitEndpoint(roomName));
  return await req.json();
}
