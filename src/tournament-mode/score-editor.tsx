import { ActionIcon, Group, Menu, Table, TextInput } from "@mantine/core";
import {
  IconSortAscending,
  IconSortDescending,
  IconCaretDown,
} from "@tabler/icons-react";
import { useDrawing } from "../drawing-context";
import { type Drawing, scoreableCharts } from "../models/Drawing";
import { useState } from "react";
import { inferShortname } from "../controls/player-names";
import { useDispatch } from "react-redux";
import { drawingsSlice } from "../state/drawings.slice";

type Comparator = (a: number | undefined, b: number | undefined) => number;

function compareScores(a: number | undefined, b: number | undefined) {
  return (a ?? -1) < (b ?? -1) ? 1 : -1;
}

function SortableColumnHeader(props: {
  name: string;
  onSort(comparator: Comparator): void;
}) {
  return (
    <Group gap={4} wrap="nowrap" justify="space-between">
      <span>{props.name}</span>
      <Menu position="bottom-end">
        <Menu.Target>
          <ActionIcon
            variant="subtle"
            color="gray"
            size="xs"
            aria-label={`Sort by ${props.name}`}
          >
            <IconCaretDown size={14} />
          </ActionIcon>
        </Menu.Target>
        <Menu.Dropdown>
          <Menu.Item
            leftSection={<IconSortAscending size={16} />}
            onClick={() => props.onSort((a, b) => compareScores(a, b))}
          >
            Sort Asc
          </Menu.Item>
          <Menu.Item
            leftSection={<IconSortDescending size={16} />}
            onClick={() => props.onSort((a, b) => compareScores(b, a))}
          >
            Sort Desc
          </Menu.Item>
        </Menu.Dropdown>
      </Menu>
    </Group>
  );
}

function EditableScoreCell(props: {
  value: string | undefined;
  onConfirm(value: string): void;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  return (
    <TextInput
      variant="unstyled"
      size="xs"
      styles={{ input: { textAlign: "right" } }}
      value={draft ?? props.value ?? ""}
      inputMode="numeric"
      onChange={(e) => setDraft(e.currentTarget.value)}
      onBlur={() => {
        if (draft !== null) {
          props.onConfirm(draft);
          setDraft(null);
        }
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.currentTarget.blur();
        }
      }}
    />
  );
}

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
    const score = Number.parseInt(rawInput.replace(/[^\d-]/g, ""), 10);
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

  function getPlayerScore(playerIdx: number, chartId: string) {
    const playerId = players[playerIdx].id;
    // a player added after scores were first entered has no bucket yet
    const scoreNum = meta.scoresByEntrant?.[playerId]?.[chartId];
    if (typeof scoreNum === "number") {
      return scoreNum;
    }
  }

  function sortPlayers(chartId: string, comparator: Comparator) {
    setPlayerOrderMap((prev) => {
      const next = prev.slice();
      next.sort((aIdx, bIdx) => {
        const aScore = getPlayerScore(aIdx, chartId);
        const bScore = getPlayerScore(bIdx, chartId);
        return comparator(aScore, bScore);
      });
      return next;
    });
  }

  const chartColumns = charts.map(({ id, chart }) => {
    const songName = chart.nameTranslation || chart.name;
    return { chartId: id, songName };
  });

  return (
    <Table withTableBorder withColumnBorders>
      <Table.Thead>
        <Table.Tr>
          <Table.Th>Player</Table.Th>
          {chartColumns.map((col) => (
            <Table.Th key={col.chartId} miw={100}>
              <SortableColumnHeader
                name={col.songName}
                onSort={(comparator) => sortPlayers(col.chartId, comparator)}
              />
            </Table.Th>
          ))}
        </Table.Tr>
      </Table.Thead>
      <Table.Tbody>
        {playerOrderMap.map((playerIdx) => (
          <Table.Tr key={players[playerIdx].id}>
            <Table.Td>{inferShortname(players[playerIdx].name)}</Table.Td>
            {chartColumns.map((col) => (
              <Table.Td key={col.chartId} p={0}>
                <EditableScoreCell
                  value={getPlayerScore(
                    playerIdx,
                    col.chartId,
                  )?.toLocaleString()}
                  onConfirm={(value) =>
                    updateScore(playerIdx, col.chartId, value)
                  }
                />
              </Table.Td>
            ))}
          </Table.Tr>
        ))}
      </Table.Tbody>
    </Table>
  );
}
