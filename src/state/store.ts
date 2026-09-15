import {
  configureStore,
  ThunkAction,
  ActionFromReducer,
  createSelector,
} from "@reduxjs/toolkit";
import { useDispatch, useSelector, useStore } from "react-redux";
import { reducer, type AppState } from "./root-reducer";
import { middleware as listener } from "./listener-middleware";
import { partyGateMiddleware } from "./party-gate-middleware";
import { invariantGuardMiddleware } from "./invariant-guard-middleware";

export function createClientStore(preloadedState?: AppState) {
  return configureStore({
    reducer,
    // the invariant guard sits inside the party gate but outside the listener,
    // so an action the reducer refuses is reported to the user and never
    // shipped to the party server
    middleware: (getDefaults) =>
      getDefaults().concat(
        partyGateMiddleware,
        invariantGuardMiddleware,
        listener,
      ),
    preloadedState,
  });
}

export type StoreType = ReturnType<typeof createClientStore>;

export type { AppState };
export const useAppState = useSelector.withTypes<AppState>();
export const createAppSelector = createSelector.withTypes<AppState>();
export type AppDispatch = StoreType["dispatch"];
export const useAppDispatch = useDispatch.withTypes<AppDispatch>();
export const useAppStore = useStore.withTypes<StoreType>();
export type AppThunk<ReturnType = void> = ThunkAction<
  ReturnType,
  AppState,
  unknown,
  ActionFromReducer<typeof reducer>
>;
