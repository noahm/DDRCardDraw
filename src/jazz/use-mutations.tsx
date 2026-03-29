/**
 * useMutations()
 *
 * Returns all Jazz mutation callbacks bound to the current room and owner.
 * Replaces `useAppDispatch()` — components call these functions directly
 * instead of dispatching Redux actions or thunk creators.
 */

import { useMemo } from "react";
import { useRoom } from "./room-context";
import {
  jazzClearDrawings,
  jazzRemoveDrawing,
  jazzResetChart,
  jazzSetWinner,
  jazzAddPlayerScore,
  jazzSwapPlayerPositions,
  jazzIncrementPriorityPlayer,
  jazzMergeDraws,
  jazzPickBanPocket,
  jazzNewDraw,
  jazzNewSubdraw,
  jazzRedrawAll,
  jazzRedrawChart,
  jazzPlusOneChart,
  jazzAddConfig,
  jazzRemoveConfig,
  jazzUpdateConfig,
  jazzNewConfig,
  jazzNewConfigFromInputs,
  jazzNewConfigFromImport,
  jazzChangeGameKey,
  jazzAddCab,
  jazzRemoveCab,
  jazzClearCabAssignment,
  jazzAssignToCab,
  jazzUpdateLabel,
  jazzRemoveLabel,
  jazzUpdateObsCss,
  jazzUpdateDrawingMeta,
} from "./jazz-mutations";
import type { DrawingMeta } from "../card-draw";
import type { Drawing } from "../models/Drawing";
import type { CompoundSetId, EligibleChart } from "../models/Drawing";
import type { ConfigState } from "../state/config.slice";
import type { CHART_DRAWN, CHART_PLACEHOLDER } from "../models/Drawing";

export function useMutations() {
  const { room, owner, roomName } = useRoom();

  return useMemo(
    () => ({
      // ---- drawings ----
      clearDrawings: () => jazzClearDrawings(room),
      removeDrawing: (id: CompoundSetId) => jazzRemoveDrawing(room, id),
      resetChart: (drawingId: CompoundSetId, chartId: string) =>
        jazzResetChart(room, drawingId, chartId),
      setWinner: (drawingId: CompoundSetId, chartId: string, player: number | null) =>
        jazzSetWinner(room, drawingId, chartId, player),
      addPlayerScore: (
        drawingId: CompoundSetId,
        chartId: string,
        playerId: string,
        score: number,
      ) => jazzAddPlayerScore(room, drawingId, chartId, playerId, score),
      updateDrawingMeta: (
        drawingId: string,
        meta: Drawing["meta"],
        playerDisplayOrder: number[],
      ) => jazzUpdateDrawingMeta(room, drawingId, meta, playerDisplayOrder),
      swapPlayerPositions: (drawingId: string) =>
        jazzSwapPlayerPositions(room, drawingId),
      incrementPriorityPlayer: (drawingId: string) =>
        jazzIncrementPriorityPlayer(room, drawingId),
      mergeDraws: (drawingId: string) =>
        jazzMergeDraws(room, owner, drawingId, `set-${Date.now()}`),

      // ---- async draw operations ----
      draw: (drawMeta: DrawingMeta, configId: string) =>
        jazzNewDraw(room, owner, drawMeta, configId),
      subdraw: (parentDrawId: string, configId: string) =>
        jazzNewSubdraw(room, owner, parentDrawId, configId),
      redrawAll: (drawId: CompoundSetId) => jazzRedrawAll(room, owner, drawId),
      redrawChart: (drawId: CompoundSetId, chartId: string) =>
        jazzRedrawChart(room, drawId, chartId),
      plusOneChart: (
        drawId: CompoundSetId,
        type: typeof CHART_DRAWN | typeof CHART_PLACEHOLDER,
      ) => jazzPlusOneChart(room, drawId, type),
      pickBanPocket: (
        drawId: CompoundSetId,
        chartId: string,
        type: "ban" | "protect" | "pocket",
        player: number,
        pick?: EligibleChart,
      ) => jazzPickBanPocket(room, owner, drawId, chartId, type, player, pick),

      // ---- configs ----
      addConfig: (config: ConfigState) => jazzAddConfig(room, owner, config),
      removeConfig: (configId: string) => jazzRemoveConfig(room, configId),
      updateConfig: (configId: string, changes: Partial<ConfigState>) =>
        jazzUpdateConfig(room, configId, changes),
      newConfig: (basisConfigId?: string) =>
        jazzNewConfig(room, owner, roomName, basisConfigId),
      newConfigFromInputs: (name: string, gameKey: string, basisConfigId?: string) =>
        jazzNewConfigFromInputs(room, owner, name, gameKey, basisConfigId),
      newConfigFromImport: (name: string, gameKey: string, imported: ConfigState) =>
        jazzNewConfigFromImport(room, owner, name, gameKey, imported),
      changeGameKey: (configId: string, gameKey: string) =>
        jazzChangeGameKey(room, configId, gameKey),

      // ---- cabs ----
      addCab: (name: string) => jazzAddCab(room, owner, name),
      removeCab: (cabId: string) => jazzRemoveCab(room, cabId),
      clearCabAssignment: (cabId: string) => jazzClearCabAssignment(room, cabId),
      assignToCab: (cabId: string, matchId: string | [string, string]) =>
        jazzAssignToCab(room, cabId, matchId),

      // ---- event ----
      updateLabel: (id: string, label: string, value: string) =>
        jazzUpdateLabel(room, owner, id, label, value),
      removeLabel: (id: string) => jazzRemoveLabel(room, id),
      updateObsCss: (css: string) => jazzUpdateObsCss(room, css),
    }),
    [room, owner, roomName],
  );
}

export type Mutations = ReturnType<typeof useMutations>;
