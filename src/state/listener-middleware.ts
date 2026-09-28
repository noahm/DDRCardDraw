import { createListenerMiddleware } from "@reduxjs/toolkit";
import type { AppState, AppDispatch } from "./store";

const listener = createListenerMiddleware();

export const middleware = listener.middleware;

export const startAppListening = listener.startListening.withTypes<
  AppState,
  AppDispatch
>();
