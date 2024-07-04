import { configureStore } from "@reduxjs/toolkit";
import { useDispatch, useSelector, useStore } from "react-redux";
import { reducer } from "./root-reducer";
import { listenerMiddleware } from "./listener-middleware";

export const store = configureStore({
  reducer,
  middleware: (getDefaults) =>
    getDefaults().concat(listenerMiddleware.middleware),
});

export type AppState = ReturnType<typeof store.getState>;
export const useAppState = useSelector.withTypes<AppState>();
export type AppDispatch = typeof store.dispatch;
export const useAppDispatch = useDispatch.withTypes<AppDispatch>();
export const useAppStore = useStore.withTypes<typeof store>();
