// oxlint-disable typescript/unbound-method
import {
  PayloadAction,
  Slice,
  createEntityAdapter,
  createSelector,
  createSlice,
} from "@reduxjs/toolkit";
import {
  CompoundSetId,
  Drawing,
  DrawnChart,
  EligibleChart,
  MergedDrawing,
  newPlayer,
  Player,
  PlayerActionOnChart,
  SubDrawing,
  PlayerPickPlaceholder,
} from "../models/Drawing";
import { mergeDraws } from "./central";

export const drawingsAdapter = createEntityAdapter<Drawing>({});

/** payload is the drawing id */
type ActionOnSingleDrawing = PayloadAction<string>;
// eslint-disable-next-line @typescript-eslint/no-empty-object-type
type ActionOnSingleChart<extra extends object = {}> = PayloadAction<
  { drawingId: CompoundSetId; chartId: string } & extra
>;
// eslint-disable-next-line @typescript-eslint/no-empty-object-type
type PlayerActionOnChartPayload<extra extends object = {}> = PayloadAction<
  {
    drawingId: CompoundSetId;
    chartId: string;
    player: string;
    reorder: boolean;
  } & extra
>;

export const drawingsSlice = createSlice({
  name: "drawings",
  initialState: drawingsAdapter.getInitialState(),
  reducers: {
    addDrawing: drawingsAdapter.addOne,
    updateOne: drawingsAdapter.updateOne,
    removeOne(state, action: PayloadAction<CompoundSetId>) {
      const [mainId, subId] = action.payload;
      if (!subId) {
        return drawingsAdapter.removeOne(state, mainId);
      }
      const drawing = state.entities[mainId];
      if (drawing.subDrawings) {
        const target = drawing.subDrawings[subId];
        delete drawing.subDrawings[subId];
        for (const chart of target.charts) {
          delete drawing.winners[chart.id];
          delete drawing.pocketPicks[chart.id];
          delete drawing.bans[chart.id];
          delete drawing.protects[chart.id];
        }
      }
    },
    clearDrawings: drawingsAdapter.removeAll,
    addOneChart(
      state,
      action: PayloadAction<{
        drawingId: CompoundSetId;
        chart: DrawnChart | PlayerPickPlaceholder;
      }>,
    ) {
      const [, target] = getDrawingFromCompoundId(
        state,
        action.payload.drawingId,
      );
      target.charts.push(action.payload.chart);
    },
    updateOneChart(
      state,
      action: PayloadAction<{
        drawingId: CompoundSetId;
        chartId: string;
        changes: Partial<DrawnChart>;
      }>,
    ) {
      const [, target] = getDrawingFromCompoundId(
        state,
        action.payload.drawingId,
      );
      const chart = target.charts.find((c) => c.id === action.payload.chartId);
      if (!chart) {
        return;
      }
      Object.assign(chart, action.payload.changes);
    },
    /**
     * Persist edits from the "edit title & players" dialog (rename/reorder/
     * add/remove). Because players carry stable ids, reordering and renaming
     * need no fixup; removing a player just means dropping the card actions
     * (winners, bans, protects, pocket picks) that still reference its
     * now-absent id.
     */
    updatePlayers(
      state,
      action: PayloadAction<{
        id: string;
        title: string;
        players: Player[];
      }>,
    ) {
      const { id, title, players } = action.payload;
      const drawing = state.entities[id];
      if (!drawing) {
        return;
      }

      const remainingIds = new Set(players.map((p) => p.id));

      for (const [chartId, winner] of Object.entries(drawing.winners)) {
        if (winner !== null && !remainingIds.has(winner)) {
          delete drawing.winners[chartId];
        }
      }

      for (const record of [
        drawing.bans,
        drawing.protects,
        drawing.pocketPicks,
      ]) {
        for (const [chartId, entry] of Object.entries(record)) {
          if (entry && !remainingIds.has(entry.player)) {
            delete record[chartId];
          }
        }
      }

      // drop the priority player if they were removed from the roster
      if (drawing.priorityPlayer && !remainingIds.has(drawing.priorityPlayer)) {
        drawing.priorityPlayer = undefined;
      }

      drawing.meta.title = title;
      drawing.meta.players = players;
    },
    swapPlayerPositions(state, action: ActionOnSingleDrawing) {
      const mainId = action.payload;
      const drawing = state.entities[mainId];
      if (!drawing) {
        return;
      }
      drawing.meta.players.reverse();
    },
    incrementPriorityPlayer(state, action: ActionOnSingleDrawing) {
      const mainId = action.payload;
      const drawing = state.entities[mainId];
      if (!drawing) {
        return;
      }
      // cycle: nobody -> first player -> ... -> last player -> nobody
      const players = drawing.meta.players;
      const currentIndex = drawing.priorityPlayer
        ? players.findIndex((p) => p.id === drawing.priorityPlayer)
        : -1;
      const next = players[currentIndex + 1];
      drawing.priorityPlayer = next?.id;
    },
    resetChart(state, action: ActionOnSingleChart) {
      const { chartId, drawingId } = action.payload;
      const [drawing] = getDrawingFromCompoundId(state, drawingId);
      if (!drawing) {
        return;
      }
      // Note: the winner is intentionally left untouched here. A chart can
      // have both an action (protect/pocket/ban) and a marked winner at the
      // same time, and removing the action should not clear the winner. The
      // winner is removed via its own control (setWinner with player: null).
      delete drawing.bans[chartId];
      delete drawing.protects[chartId];
      delete drawing.pocketPicks[chartId];
    },
    banProtectReplace(
      state,
      action: PlayerActionOnChartPayload<
        { type: "ban" | "protect" } | { type: "pocket"; pick: EligibleChart }
      >,
    ) {
      const { chartId, drawingId, player, reorder } = action.payload;
      const [drawing, target] = getDrawingFromCompoundId(state, drawingId);
      if (!drawing) {
        return;
      }
      const playerAction: PlayerActionOnChart = { chartId, player };
      if (action.payload.type === "ban") {
        if (reorder) {
          target.charts = moveChartInArray(
            drawing,
            target.charts,
            chartId,
            "end",
          );
        }
        drawing.bans[chartId] = playerAction;
      } else if (action.payload.type === "protect") {
        if (reorder) {
          target.charts = moveChartInArray(
            drawing,
            target.charts,
            chartId,
            "start",
          );
        }
        drawing.protects[chartId] = playerAction;
      } else if (action.payload.type === "pocket") {
        if (reorder) {
          target.charts = moveChartInArray(
            drawing,
            target.charts,
            chartId,
            "start",
          );
        }
        drawing.pocketPicks[chartId] = {
          chartId,
          player,
          pick: action.payload.pick,
        };
      }
    },
    setWinner(state, action: ActionOnSingleChart<{ player: string | null }>) {
      const [drawing] = getDrawingFromCompoundId(
        state,
        action.payload.drawingId,
      );
      const winners = drawing.winners;
      if (action.payload.player === null) {
        delete winners[action.payload.chartId];
      } else {
        winners[action.payload.chartId] = action.payload.player;
      }
    },
    addPlayerScore(
      state,
      action: PayloadAction<{
        drawingId: CompoundSetId;
        chartId: string;
        playerId: string;
        score: number;
      }>,
    ) {
      const { drawingId, playerId, chartId, score } = action.payload;
      const [mainId] = drawingId;
      const drawing = state.entities[mainId];
      if (!drawing) {
        return;
      }
      if (
        drawing.meta.type !== "startgg" ||
        drawing.meta.subtype !== "gauntlet"
      ) {
        return;
      }
      if (!drawing.meta.scoresByEntrant) {
        drawing.meta.scoresByEntrant = {};
        for (const entrant of drawing.meta.players) {
          drawing.meta.scoresByEntrant[entrant.id] = {};
        }
      }
      drawing.meta.scoresByEntrant[playerId][chartId] = score;
    },
    addSubdraw(
      state,
      action: PayloadAction<{ newSubdraw: SubDrawing; existingDrawId: string }>,
    ) {
      const { existingDrawId, newSubdraw } = action.payload;
      const existingDraw = state.entities[existingDrawId];
      if (!existingDraw.subDrawings) {
        existingDraw.subDrawings = {};
      }
      existingDraw.subDrawings[newSubdraw.compoundId[1]] = newSubdraw;
    },
    updateCharts(
      state,
      action: PayloadAction<{
        drawId: CompoundSetId;
        newCharts: SubDrawing["charts"];
      }>,
    ) {
      const { newCharts, drawId } = action.payload;
      const [parent, target] = getDrawingFromCompoundId(state, drawId);
      // cleanup charts being removed
      for (const chart of target.charts) {
        if (!newCharts.some((c) => c.id === chart.id)) {
          // `chart` is not in the new set, so we should remove
          delete parent.winners[chart.id];
          delete parent.bans[chart.id];
          delete parent.pocketPicks[chart.id];
          delete parent.protects[chart.id];
        }
      }
      target.charts = newCharts;
    },
  },
  extraReducers(builder) {
    builder.addCase(
      mergeDraws,
      (state, { payload: { drawingId, newSubdrawId } }) => {
        const draw = state.entities[drawingId];
        if (!draw) return;
        const oldDraws = draw.subDrawings;
        draw.subDrawings = {
          [newSubdrawId]: {
            compoundId: [drawingId, newSubdrawId],
            configId: draw.configId,
            charts: Object.values(oldDraws).flatMap(
              (subDraw) => subDraw.charts,
            ),
          },
        };
      },
    );
  },
  selectors: {
    haveDrawings(state) {
      return !!state.ids.length;
    },
    byCompoundOrPlainId(state, id: CompoundSetId | string) {
      if (typeof id === "string") return [state.entities[id]];
      return getDrawingFromCompoundId(state, id);
    },
    selectMergedByCompoundId(state, compoundId: CompoundSetId) {
      return selectMergedByCompoundId(state, compoundId);
    },
  },
});

export const drawingSelectors = drawingsAdapter.getSelectors(
  drawingsSlice.selectSlice,
);

type StateOfSlice<S> = S extends Slice<infer State> ? State : never;

/** one-time migration for old data. mutates state */
export function migrateToSubdraws(state: StateOfSlice<typeof drawingsSlice>) {
  for (const id of state.ids) {
    const parent = state.entities[id];
    if (parent.subDrawings) {
      for (const [subId, subDraw] of Object.entries(parent.subDrawings)) {
        // @ts-expect-error this field no longer exists
        delete subDraw.id;
        if (!subDraw.compoundId) {
          subDraw.compoundId = [parent.id, subId];
        }
      }
    } else {
      parent.subDrawings = {};
    }
    if (parent.charts) {
      parent.subDrawings[parent.id] = {
        compoundId: [parent.id, parent.id],
        configId: parent.configId,
        charts: parent.charts,
      };
      delete parent.charts;
    }
  }
}

/**
 * one-time migration from the old player model to the current one. The old
 * model gave players plain string names (simple) or a `meta.entrants` array
 * (startgg), kept display order in a separate `playerDisplayOrder` field, and
 * referenced players by numeric index in `playerDisplayOrder`/`winners`/action
 * `player`. The new model gives every player a stable id under `meta.players`,
 * stores that array directly in display order, and references players by id.
 *
 * The presence of a `playerDisplayOrder` field marks a drawing still in an old
 * shape, so this is idempotent (already-migrated drawings are skipped). mutates
 * state.
 */
export function migratePlayersToIds(state: StateOfSlice<typeof drawingsSlice>) {
  for (const id of state.ids) {
    const drawing = state.entities[id];
    if (!drawing) {
      continue;
    }
    // `playerDisplayOrder` no longer exists on the model; its presence means
    // the drawing predates this migration.
    const legacyDrawing = drawing as unknown as {
      playerDisplayOrder?: Array<number | string>;
      priorityPlayer?: number | string;
    };
    const legacyOrder = legacyDrawing.playerDisplayOrder;
    if (!legacyOrder) {
      continue;
    }

    // startgg used to store players under `entrants`
    const legacyMeta = drawing.meta as unknown as {
      players?: Array<string | Player>;
      entrants?: Player[];
    };
    const rawPlayers = legacyMeta.players ?? legacyMeta.entrants ?? [];

    // ensure every player is an object carrying a stable id (simple drawings
    // used to store plain name strings)
    const players: Player[] = rawPlayers.map((p) =>
      typeof p === "string" ? newPlayer(p) : p,
    );

    // legacy references were numeric indices into this (original-order) players
    // array; normalize both those and any already-id references to a player id.
    // A dangling index yields undefined, so its reference is dropped.
    const idFor = (ref: number | string): string | undefined =>
      typeof ref === "number" ? players[ref]?.id : ref;

    // fold the separate display order into the players array order
    const byId = new Map(players.map((p) => [p.id, p]));
    const ordered: Player[] = [];
    for (const ref of legacyOrder) {
      const player = byId.get(idFor(ref)!);
      if (player) {
        ordered.push(player);
        byId.delete(player.id);
      }
    }
    // append any players not referenced by the display order (defensive)
    ordered.push(...byId.values());

    drawing.meta.players = ordered;
    delete legacyMeta.entrants;
    delete legacyDrawing.playerDisplayOrder;

    const legacyWinners = drawing.winners as Record<
      string,
      number | string | null
    >;
    for (const [chartId, val] of Object.entries(legacyWinners)) {
      if (val === null) {
        continue;
      }
      const winnerId = idFor(val);
      if (winnerId === undefined) {
        delete drawing.winners[chartId];
      } else {
        drawing.winners[chartId] = winnerId;
      }
    }

    for (const record of [
      drawing.bans,
      drawing.protects,
      drawing.pocketPicks,
    ]) {
      for (const [chartId, entry] of Object.entries(record)) {
        if (!entry) {
          continue;
        }
        const action = entry as { player: number | string };
        const playerId = idFor(action.player);
        if (playerId === undefined) {
          delete record[chartId];
        } else {
          action.player = playerId;
        }
      }
    }

    // priorityPlayer was a 1-based display position; resolve it to a player id
    const priority = legacyDrawing.priorityPlayer;
    if (typeof priority === "number") {
      drawing.priorityPlayer = ordered[priority - 1]?.id;
    }
  }
}

export function getDrawingFromCompoundId(
  state: StateOfSlice<typeof drawingsSlice>,
  id: CompoundSetId,
): [parent: Drawing, target: SubDrawing] {
  const [mainId, subId] = id;
  const drawing = state.entities[mainId];
  return [drawing, drawing.subDrawings[subId]];
}

const selectMergedByCompoundId = createSelector(
  [
    (s: StateOfSlice<typeof drawingsSlice>, drawingId: CompoundSetId) =>
      s.entities[drawingId[0]],
    (s: StateOfSlice<typeof drawingsSlice>, drawingId: CompoundSetId) =>
      s.entities[drawingId[0]]?.subDrawings?.[drawingId[1]],
  ],
  (drawing, subDrawing): MergedDrawing => {
    return { ...drawing, ...subDrawing };
  },
);

function moveChartInArray(
  drawing: Drawing,
  charts: SubDrawing["charts"],
  chartId: string,
  pos: "start" | "end",
) {
  const targetChart = charts.find((c) => c.id === chartId);
  if (!targetChart) {
    return charts;
  }
  const chartsWithoutTarget = charts.filter((c) => c.id !== chartId);
  if (pos === "start") {
    const insertIdx =
      Object.keys(drawing.protects).length +
      Object.keys(drawing.pocketPicks).length;
    chartsWithoutTarget.splice(insertIdx, 0, targetChart);
  } else {
    chartsWithoutTarget.push(targetChart);
  }
  return chartsWithoutTarget;
}
