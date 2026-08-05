import { useParams } from "react-router-dom";

export function useRoomName() {
  const params = useParams<"roomName">();
  return params.roomName || "classic";
}
