import { createContext, useContext } from "react";
import { drawingSelectors, drawingsSlice } from "./state/drawings.slice";
import { Drawing } from "./models/Drawing";
import { useAppDispatch, useAppState } from "./state/store";
import { EqualityFn } from "react-redux";

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
const DrawingProvider = context.Provider;

function useDrawing<T>(
  selector: (d: Drawing) => T,
  equalityFn?: EqualityFn<T>,
) {
  const drawingId = useContext(context);
  return useAppState((state) => {
    const drawing =
      drawingSelectors.selectById(state, drawingId) || stubDrawing;
    return selector(drawing);
  }, equalityFn);
}

export function useUpdateDrawing(): (changes: Partial<Drawing>) => void {
  const drawingId = useContext(context);
  const dispatch = useAppDispatch();

  if (!drawingId) {
    return () => {};
  }
  return (changes) =>
    dispatch(drawingsSlice.actions.updateOne({ id: drawingId, changes }));
}

export { useDrawing, DrawingProvider };
