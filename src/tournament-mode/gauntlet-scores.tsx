import { HotkeysProvider } from "@blueprintjs/core";
import {
  Column,
  Table2,
  EditableCell2,
  ColumnProps,
  Cell,
} from "@blueprintjs/table";
import { useDrawing } from "../drawing-context";
import { type DrawnChart, StartggGauntletMeta } from "../models/Drawing";
import { ReactElement, useState } from "react";
import { inferShortname } from "../controls/player-names";
import { useDispatch } from "react-redux";
import { drawingsSlice } from "../state/drawings.slice";
import { ScoreSortableColumn } from "./sortable-columns";

export default function GauntletScoreEditor({
  meta,
}: {
  meta: StartggGauntletMeta;
}) {
  const drawingId = useDrawing((d) => d.id);
  const bans = useDrawing((d) => d.bans);
  const pocketPicks = useDrawing((d) => d.pocketPicks);
  const charts = useDrawing((d) => d.charts).filter(
    (c): c is DrawnChart => c.type === "DRAWN" && !bans[c.id],
  );
  const dispatch = useDispatch();
  const [playerOrderMap, setPlayerOrderMap] = useState(
    meta.entrants.map((_, idx) => idx),
  );

  const players = meta.entrants;

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
    if (meta.scoresByEntrant) {
      const playerId = players[playerIdx].id;
      const scoreNum = meta.scoresByEntrant[playerId][chartId];
      if (typeof scoreNum === "number") {
        return scoreNum;
      }
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

  const chartCols = charts.map<ReactElement<ColumnProps>>((c) => {
    const maybeReplacedBy = pocketPicks[c.id]?.pick;
    let songName = c.nameTranslation || c.name;
    if (maybeReplacedBy) {
      songName = maybeReplacedBy.nameTranslation || maybeReplacedBy.name;
    }
    const sortableColumn = new ScoreSortableColumn(songName, c.id);
    return sortableColumn.getColumn(
      (rowIdx) => playerScoreRenderer(rowIdx, c.id),
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
