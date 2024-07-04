import { createListenerMiddleware } from "@reduxjs/toolkit";
import type { AppState, AppDispatch } from "./store";

export const listenerMiddleware = createListenerMiddleware();

export const startAppListening = listenerMiddleware.startListening.withTypes<
  AppState,
  AppDispatch
>();
