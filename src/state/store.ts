import { configureStore, combineSlices } from "@reduxjs/toolkit";
import { useDispatch, useSelector, useStore } from "react-redux";
import { drawingsSlice } from "./drawings.slice";
import { configSlice } from "./config.slice";
import { gameDataSlice } from "./game-data.slice";

export const store = configureStore({
  reducer: combineSlices(drawingsSlice, configSlice, gameDataSlice),
});

export type AppState = ReturnType<typeof store.getState>;
export const useAppState = useSelector.withTypes<AppState>();
export type AppDispatch = typeof store.dispatch;
export const useAppDispatch = useDispatch.withTypes<AppDispatch>();
export const useAppStore = useStore.withTypes<typeof store>();
