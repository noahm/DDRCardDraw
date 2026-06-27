import { createContext, ReactNode, useContext, useDebugValue } from "react";
import { CompoundSetId, MergedDrawing } from "./models/Drawing";
import { useAppState } from "./state/store";
import { EqualityFn } from "react-redux";
import { ConfigContextProvider } from "./state/hooks";
import { drawingsSlice } from "./state/drawings.slice";

const context = createContext<CompoundSetId>(["", ""]);
const RawDrawingProvider = context.Provider;

export function useDrawing<T>(
  selector: (d: MergedDrawing) => T,
  equalityFn?: EqualityFn<T>,
) {
  const drawingId = useContext(context);
  const ret = useAppState((state) => {
    const drawing = drawingsSlice.selectors.selectMergedByCompoundId(
      state,
      drawingId,
    );
    return selector(drawing);
  }, equalityFn);
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
