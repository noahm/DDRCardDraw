import { HotkeysProvider } from "@blueprintjs/core";
import {
  Column,
  Table2,
  EditableCell2,
  ColumnProps,
  Cell,
} from "@blueprintjs/table";
import { useDrawing } from "../drawing-context";
import { type Drawing, scoreableCharts } from "../models/Drawing";
import { ReactElement, useState } from "react";
import { inferShortname } from "../controls/player-names";
import { useDispatch } from "react-redux";
import { drawingsSlice } from "../state/drawings.slice";
import { ScoreSortableColumn } from "./sortable-columns";

export default function ScoreEditor({ meta }: { meta: Drawing["meta"] }) {
  const drawingId = useDrawing((d) => d.compoundId);
  const bans = useDrawing((d) => d.bans);
  const pocketPicks = useDrawing((d) => d.pocketPicks);
  const drawnCards = useDrawing((d) => d.charts);
  // free picks get a column of their own once filled, the same as any other
  // card — scores on them key off the placeholder that was drawn
  const charts = scoreableCharts(drawnCards, { bans, pocketPicks });
  const dispatch = useDispatch();
  const [playerOrderMap, setPlayerOrderMap] = useState(
    meta.players.map((_, idx) => idx),
  );

  const players = meta.players;

  function updateScore(playerIdx: number, chartId: string, rawInput: string) {
    const playerId = players[playerIdx].id;
    const score = Number.parseInt(rawInput, 10);
    if (!Number.isSafeInteger(score)) {
      return;
    }
    dispatch(
      drawingsSlice.actions.addPlayerScore({
        drawingId,
        chartId,
        playerId,
        score,
      }),
    );
  }

  function playerCellRenderer(displayIdx: number) {
    const playerIdx = playerOrderMap[displayIdx];
    return <Cell>{inferShortname(players[playerIdx].name)}</Cell>;
  }
  function getPlayerScore(displayIdx: number, chartId: string) {
    const playerIdx = playerOrderMap[displayIdx];
    const playerId = players[playerIdx].id;
    // a player added after scores were first entered has no bucket yet
    const scoreNum = meta.scoresByEntrant?.[playerId]?.[chartId];
    if (typeof scoreNum === "number") {
      return scoreNum;
    }
  }

  function playerScoreRenderer(displayIdx: number, chartId: string) {
    const playerIdx = playerOrderMap[displayIdx];
    const score = getPlayerScore(displayIdx, chartId)?.toLocaleString();
    return (
      <EditableCell2
        style={{ textAlign: "right" }}
        value={score}
        onConfirm={(value) => updateScore(playerIdx, chartId, value)}
      />
    );
  }

  const chartCols = charts.map<ReactElement<ColumnProps>>(({ id, chart }) => {
    const songName = chart.nameTranslation || chart.name;
    const sortableColumn = new ScoreSortableColumn(songName, id);
    return sortableColumn.getColumn(
      (rowIdx) => playerScoreRenderer(rowIdx, id),
      (chartId, comparator) => {
        setPlayerOrderMap((prev) => {
          const next = prev.slice();
          next.sort((aIdx, bIdx) => {
            const aScore = getPlayerScore(aIdx, chartId);
            const bScore = getPlayerScore(bIdx, chartId);
            return comparator(aScore, bScore);
          });
          return next;
        });
      },
    );
  });

  chartCols.unshift(
    <Column key="players" name="Player" cellRenderer={playerCellRenderer} />,
  );

  return (
    <HotkeysProvider>
      <Table2
        numRows={players.length}
        enableFocusedCell
        defaultColumnWidth={80}
        cellRendererDependencies={[
          playerOrderMap,
          players,
          charts,
          bans,
          pocketPicks,
          meta.scoresByEntrant,
        ]}
      >
        {chartCols}
      </Table2>
    </HotkeysProvider>
  );
}
