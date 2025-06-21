import { createContext, ReactNode, useContext, useDebugValue } from "react";
import { drawingSelectors } from "./state/drawings.slice";
import { Drawing } from "./models/Drawing";
import { createAppSelector, useAppState } from "./state/store";
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
      subDraw &&
      drawingSelectors.selectById(s, drawingId)?.subDrawings?.[subDraw],
  ],
  (drawing, subDrawing) => {
    if (!subDrawing) return drawing || stubDrawing;
    return {
      ...drawing,
      ...subDrawing,
      id: `${drawing.id}:${subDrawing.id}`,
    };
  },
);

export function useDrawing<T>(
  selector: (d: Drawing) => T,
  equalityFn?: EqualityFn<T>,
) {
  const drawingId = useContext(context);
  const subDrawId = useContext(subDrawContext);
  const ret = useAppState((state) => {
    const drawing = selectDrawingByIdAndSubId(state, drawingId, subDrawId);
    return selector(drawing);
  }, equalityFn);
  useDebugValue(ret);
  return ret;
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
