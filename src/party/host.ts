import type { AppState } from "../state/root-reducer";

/** where the event-mode sync Worker is served, set at build time by webpack */
export const PARTY_HOST = process.env.PARTY_HOST as string;

const ENDPOINT_PROTOCOL = /^(localhost|127\.0\.0\.1)(:|$)/.test(PARTY_HOST)
  ? "http"
  : "https";

export function partyEndpoint(roomName: string) {
  return `${ENDPOINT_PROTOCOL}://${PARTY_HOST}/parties/main/${roomName}`;
}

export async function getPartyState(roomName: string): Promise<AppState> {
  const req = await fetch(partyEndpoint(roomName));
  return await req.json();
}
