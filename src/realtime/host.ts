import type { AppState } from "../state/root-reducer";

export const REALTIME_HOST =
  process.env.NODE_ENV === "development"
    ? "localhost:1999"
    : (process.env.REALTIME_HOST as string | undefined) || "localhost:1999";

const ENDPOINT_PROTOCOL =
  process.env.NODE_ENV === "development" ? "http" : "https";

export function roomEndpoint(roomName: string) {
  return `${ENDPOINT_PROTOCOL}://${REALTIME_HOST}/parties/main/${roomName}`;
}

export async function getRoomState(roomName: string): Promise<AppState> {
  const req = await fetch(roomEndpoint(roomName));
  return await req.json();
}
