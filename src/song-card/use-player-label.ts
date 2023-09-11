import { useDrawing } from "../drawing-context";

export function usePlayerLabel(n: number) {
  return useDrawing((d) => d.players[n - 1] || `P${n}`);
}
