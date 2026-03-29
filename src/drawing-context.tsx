import { createContext, ReactNode, useContext, useDebugValue } from "react";
import { CompoundSetId, MergedDrawing } from "./models/Drawing";
import { ConfigContextProvider } from "./state/hooks";
import { useRoomState } from "./jazz/app-state-context";

const context = createContext<CompoundSetId>(["", ""]);
const RawDrawingProvider = context.Provider;

export function useDrawing<T>(selector: (d: MergedDrawing) => T): T {
  const drawingId = useContext(context);
  const ret = useRoomState((state) => {
    const drawing = state.drawings.entities[drawingId[0]];
    if (!drawing) return null as unknown as T;
    const subDrawing = drawing.subDrawings?.[drawingId[1]];
    const merged: MergedDrawing = { ...drawing, ...subDrawing };
    return selector(merged);
  });
  useDebugValue(ret);
  return ret;
}

export function DrawingProvider({
  drawingId,
  children,
}: {
  drawingId: CompoundSetId;
  children: ReactNode;
}) {
  return (
    <RawDrawingProvider value={drawingId}>
      <ContextualConfigProvider>{children}</ContextualConfigProvider>
    </RawDrawingProvider>
  );
}

function ContextualConfigProvider({ children }: { children: ReactNode }) {
  const configId = useDrawing((d) => d.configId);
  return (
    <ConfigContextProvider value={configId}>{children}</ConfigContextProvider>
  );
}
