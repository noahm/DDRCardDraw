import { createContext, ReactNode, useContext } from "react";
import { drawingSelectors, drawingsSlice } from "./state/drawings.slice";
import { Drawing } from "./models/Drawing";
import { createAppSelector, useAppDispatch, useAppState } from "./state/store";
import { EqualityFn } from "react-redux";
import { ConfigContextProvider } from "./state/hooks";

const stubDrawing: Drawing = {
  id: "",
  configId: "",
  meta: {
    type: "simple",
    players: [],
    title: "",
  },
  playerDisplayOrder: [],
  bans: {},
  charts: [],
  pocketPicks: {},
  protects: {},
  winners: {},
};

const context = createContext<string>("");
const RawDrawingProvider = context.Provider;

const subDrawContext = createContext<string>("");
const SubDrawingProvider = subDrawContext.Provider;

const selectDrawingByIdAndSubId = createAppSelector(
  [
    (s, drawingId: string) => drawingSelectors.selectById(s, drawingId),
    (s, drawingId: string, subDraw: string | undefined) =>
      drawingSelectors
        .selectById(s, drawingId)
        ?.subDrawings?.find((d) => d.id === subDraw),
  ],
  (drawing, subDrawing) => {
    if (!subDrawContext) return drawing || stubDrawing;
    return {
      ...drawing,
      ...subDrawing,
    };
  },
);

export function useDrawing<T>(
  selector: (d: Drawing) => T,
  equalityFn?: EqualityFn<T>,
) {
  const drawingId = useContext(context);
  const subDrawId = useContext(subDrawContext);
  return useAppState((state) => {
    const drawing = selectDrawingByIdAndSubId(state, drawingId, subDrawId);
    return selector(drawing);
  }, equalityFn);
}

/** @todo figure out updating sub drawings somehow */
export function useUpdateDrawing(): (changes: Partial<Drawing>) => void {
  const drawingId = useContext(context);
  const dispatch = useAppDispatch();

  if (!drawingId) {
    return () => {};
  }
  return (changes) =>
    dispatch(drawingsSlice.actions.updateOne({ id: drawingId, changes }));
}

export function DrawingProvider({
  drawingId,
  subDrawId,
  children,
}: {
  drawingId: string;
  subDrawId?: string;
  children: ReactNode;
}) {
  const ret = (
    <RawDrawingProvider value={drawingId}>
      <ContextualConfigProvider>{children}</ContextualConfigProvider>
    </RawDrawingProvider>
  );
  if (subDrawId) {
    return <SubDrawingProvider value={subDrawId}>{ret}</SubDrawingProvider>;
  }
  return ret;
}

function ContextualConfigProvider({ children }: { children: ReactNode }) {
  const configId = useDrawing((d) => d.configId);
  return (
    <ConfigContextProvider value={configId}>{children}</ConfigContextProvider>
  );
}
