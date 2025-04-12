import {
  configureStore,
  ThunkAction,
  ActionFromReducer,
  createSelector,
} from "@reduxjs/toolkit";
import { useDispatch, useSelector, useStore } from "react-redux";
import { reducer, type AppState } from "./root-reducer";
import { middleware as listener } from "./listener-middleware";
import { preloadedState } from "./localstorage";

export const store = configureStore({
  reducer,
  middleware: (getDefaults) => getDefaults().concat(listener),
  preloadedState,
});

export type { AppState };
export const useAppState = useSelector.withTypes<AppState>();
export const createAppSelector = createSelector.withTypes<AppState>();
export type AppDispatch = typeof store.dispatch;
export const useAppDispatch = useDispatch.withTypes<AppDispatch>();
export const useAppStore = useStore.withTypes<typeof store>();
export type AppThunk<ReturnType = void> = ThunkAction<
  ReturnType,
  AppState,
  unknown,
  ActionFromReducer<typeof reducer>
>;
