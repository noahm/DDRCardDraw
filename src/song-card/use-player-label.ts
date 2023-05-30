import { useDrawing } from "../drawing-context";

export function usePlayerLabel(n: 1 | 2) {
  return useDrawing((d) => d[`player${n}`] || `P${n}`);
}
