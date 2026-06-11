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

/**
 * Uploads an image asset for a room and returns an absolute URL it can be
 * fetched from by any client connected to that room.
 */
export async function uploadRoomAsset(
  roomName: string,
  blob: Blob,
): Promise<string> {
  const res = await fetch(`${roomEndpoint(roomName)}/assets`, {
    method: "POST",
    headers: { "Content-Type": blob.type },
    body: blob,
  });
  if (!res.ok) {
    throw new Error(`failed to upload asset: ${res.status} ${res.statusText}`);
  }
  const { url } = (await res.json()) as { url: string };
  return `${ENDPOINT_PROTOCOL}://${REALTIME_HOST}${url}`;
}
