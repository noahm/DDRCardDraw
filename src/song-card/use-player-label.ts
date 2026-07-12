import { useDrawing } from "../drawing-context";
import { playerNameById } from "../models/Drawing";

export function usePlayerLabelForId(playerId: string) {
  return useDrawing((d) => playerNameById(d.meta, playerId));
}
