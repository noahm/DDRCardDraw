import {
  Alert,
  Badge,
  Button,
  Group,
  Loader,
  NativeSelect,
  Table,
} from "@mantine/core";
import { IconRefresh } from "@tabler/icons-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useDrawing } from "../drawing-context";
import {
  CHART_DRAWN,
  type ExternalMeta,
  playerDisplayName,
} from "../models/Drawing";
import { drawingsSlice } from "../state/drawings.slice";
import { useGameData } from "../state/hooks";
import {
  useLinkSmxUsername,
  useSmxUsernames,
} from "../state/smx-usernames.atoms";
import { useAppDispatch } from "../state/store";
import { convertErrorToString } from "../utils/error-to-string";
import {
  fetchRecentPlays,
  matchUsernameToPlayer,
  type RecentPlay,
  resolveSmxCharts,
  type SmxChartTarget,
  smxChartKey,
} from "../utils/smx-scores";
import styles from "./smx-score-import.css";

/** windows offered for "how far back to look", in minutes */
const WINDOW_OPTIONS = [5, 10, 15, 30, 60];

const DEFAULT_WINDOW = 15;

/**
 * How often the feed is re-read while the dialog sits open. Short enough that a
 * play lands in the list on its own during a match, long enough to stay polite
 * to a free community API.
 */
const REFRESH_INTERVAL = 20_000;

/** "no entrant", as the value of an unassigned row's select */
const UNASSIGNED = "";

/**
 * Semi-automatic score recording for a StepManiaX match: shows the plays the
 * global score feed recorded on this drawing's charts in the last few minutes
 * and lets an operator say which entrant each one belongs to before recording
 * them. See ../utils/smx-scores for why a human stays in the loop.
 */
export default function SmxScoreImport({
  meta,
  onClose,
}: {
  meta: ExternalMeta;
  onClose: () => void;
}) {
  const drawingId = useDrawing((d) => d.compoundId);
  const charts = useDrawing((d) => d.charts);
  const bans = useDrawing((d) => d.bans);
  const pocketPicks = useDrawing((d) => d.pocketPicks);
  const gameData = useGameData();
  const linkedUsernames = useSmxUsernames();
  const linkSmxUsername = useLinkSmxUsername();
  const dispatch = useAppDispatch();

  const [windowMinutes, setWindowMinutes] = useState(DEFAULT_WINDOW);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();
  const [plays, setPlays] = useState<RecentPlay[]>([]);
  const [unresolved, setUnresolved] = useState<SmxChartTarget[]>([]);
  const [loadedAt, setLoadedAt] = useState<number>();
  /** rows the operator set by hand, which the guesses no longer touch */
  const [overrides, setOverrides] = useState<Record<number, string>>({});

  /**
   * The charts to watch the feed for: everything drawn and not banned, with a
   * pocket pick standing in for the chart it replaced (that's what got played).
   */
  const targets = useMemo(() => {
    if (!gameData) {
      return [];
    }
    const found: SmxChartTarget[] = [];
    for (const drawn of charts) {
      if (bans[drawn.id]) {
        continue;
      }
      const played =
        pocketPicks[drawn.id]?.pick ||
        (drawn.type === CHART_DRAWN ? drawn : undefined);
      if (!played) {
        // a player pick nobody has filled in yet
        continue;
      }
      const key = smxChartKey(played, gameData);
      if (key) {
        found.push({ chartId: drawn.id, chart: played, key });
      }
    }
    return found;
  }, [charts, bans, pocketPicks, gameData]);

  const load = useCallback(
    async (signal: AbortSignal) => {
      setLoading(true);
      try {
        const resolved = await resolveSmxCharts(targets, signal);
        const found = await fetchRecentPlays(
          resolved,
          Date.now() - windowMinutes * 60_000,
          signal,
        );
        if (signal.aborted) {
          return;
        }
        setUnresolved(resolved.unresolved);
        setPlays(found);
        setLoadedAt(Date.now());
        setError(undefined);
      } catch (e) {
        if (!signal.aborted) {
          setError(convertErrorToString(e));
        }
      } finally {
        if (!signal.aborted) {
          setLoading(false);
        }
      }
    },
    [targets, windowMinutes],
  );

  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal);
    const timer = setInterval(
      () => void load(controller.signal),
      REFRESH_INTERVAL,
    );
    return () => {
      controller.abort();
      clearInterval(timer);
    };
  }, [load]);

  /**
   * Who each play probably belongs to. Only the newest play a player has on a
   * given chart is guessed at: an earlier attempt on the same chart is left
   * unassigned rather than silently overwriting the one that counted.
   */
  const guesses = useMemo(() => {
    const byPlay = new Map<number, string>();
    const claimed = new Set<string>();
    for (const play of plays) {
      const playerId = matchUsernameToPlayer(
        play.username,
        meta.players,
        linkedUsernames,
      );
      if (!playerId) {
        continue;
      }
      const slot = `${playerId}:${play.target.chartId}`;
      if (claimed.has(slot)) {
        continue;
      }
      claimed.add(slot);
      byPlay.set(play.id, playerId);
    }
    return byPlay;
  }, [plays, meta.players, linkedUsernames]);

  const assignmentFor = useCallback(
    (play: RecentPlay) =>
      overrides[play.id] ?? guesses.get(play.id) ?? UNASSIGNED,
    [overrides, guesses],
  );

  const assigned = plays.filter((p) => assignmentFor(p) !== UNASSIGNED);

  /**
   * Rows another assigned row would overwrite: two plays assigned to the same
   * entrant on the same chart, where only the newest survives. `plays` is
   * newest first, so the first row to claim a slot is the one that sticks.
   */
  const overwritten = new Set<number>();
  const claimedSlots = new Set<string>();
  for (const play of assigned) {
    const slot = `${assignmentFor(play)}:${play.target.chartId}`;
    if (claimedSlots.has(slot)) {
      overwritten.add(play.id);
    }
    claimedSlots.add(slot);
  }

  function applyScores() {
    // oldest first so that when two plays land on one entrant's chart, the one
    // they put up most recently is the score left on file
    const ordered = assigned
      .slice()
      .sort((a, b) => (a.playedAt ?? 0) - (b.playedAt ?? 0));
    for (const play of ordered) {
      const playerId = assignmentFor(play);
      dispatch(
        drawingsSlice.actions.addPlayerScore({
          drawingId,
          chartId: play.target.chartId,
          playerId,
          score: play.score,
        }),
      );
      // the operator just told us whose tag this is — remember it for next time
      const player = meta.players.find((p) => p.id === playerId);
      if (player && play.username) {
        linkSmxUsername(player.name, play.username);
      }
    }
    onClose();
  }

  const noSmxCharts = !targets.length;

  return (
    <>
      <div className={styles.toolbar}>
        <label className={styles.windowPicker}>
          Plays from the last
          <NativeSelect
            size="xs"
            value={windowMinutes}
            onChange={(e) => setWindowMinutes(Number(e.currentTarget.value))}
            data={WINDOW_OPTIONS.map((mins) => ({
              value: String(mins),
              label: `${mins} minutes`,
            }))}
          />
        </label>
        <span className={styles.status}>
          {loading ? (
            <Loader size="xs" />
          ) : (
            loadedAt && `updated ${timeAgo(loadedAt)}`
          )}
        </span>
        <Button
          variant="subtle"
          color="gray"
          size="compact-sm"
          leftSection={<IconRefresh size={16} />}
          disabled={loading}
          onClick={() => void load(new AbortController().signal)}
        >
          Refresh
        </Button>
      </div>

      {error && (
        <Alert color="red" title="Couldn't read the SMX score feed" mb="sm">
          {error}
        </Alert>
      )}
      {noSmxCharts && (
        <Alert color="yellow" title="Nothing to look up" mb="sm">
          None of the charts in this set carry an SMX song id, so there's
          nothing to match plays against.
        </Alert>
      )}
      {!!unresolved.length && (
        <Alert color="yellow" title="Some charts can't be matched" mb="sm">
          The score feed carries nothing for{" "}
          {unresolved
            .map((t) => `${t.chart.name} (${t.chart.diffAbbr})`)
            .join(", ")}
          , so plays on those have to be entered by hand. Team charts are never
          in the feed.
        </Alert>
      )}

      {!!plays.length && (
        <Table
          striped
          horizontalSpacing="xs"
          verticalSpacing="xs"
          className={styles.playTable}
        >
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Record as</Table.Th>
              <Table.Th>SMX player</Table.Th>
              <Table.Th className={styles.numeric}>Score</Table.Th>
              <Table.Th>Chart</Table.Th>
              <Table.Th>When</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {plays.map((play) => (
              <PlayRow
                key={play.id}
                play={play}
                meta={meta}
                assignedTo={assignmentFor(play)}
                isOverwritten={overwritten.has(play.id)}
                onAssign={(playerId) =>
                  setOverrides((prev) => ({ ...prev, [play.id]: playerId }))
                }
              />
            ))}
          </Table.Tbody>
        </Table>
      )}
      {!plays.length && !loading && !error && !noSmxCharts && (
        <p className={styles.empty}>
          No plays on this set's charts in the last {windowMinutes} minutes. The
          dialog keeps checking, so leave it open while the match is played.
        </p>
      )}
      <Group justify="flex-end" mt="md">
        <Button variant="default" onClick={onClose}>
          Cancel
        </Button>
        <Button disabled={!assigned.length} onClick={applyScores}>
          {assigned.length === 1
            ? "Record 1 score"
            : `Record ${assigned.length} scores`}
        </Button>
      </Group>
    </>
  );
}

function PlayRow({
  play,
  meta,
  assignedTo,
  isOverwritten,
  onAssign,
}: {
  play: RecentPlay;
  meta: ExternalMeta;
  assignedTo: string;
  isOverwritten: boolean;
  onAssign: (playerId: string) => void;
}) {
  const existingScore =
    assignedTo === UNASSIGNED
      ? undefined
      : meta.scoresByEntrant?.[assignedTo]?.[play.target.chartId];
  const chart = play.target.chart;
  return (
    <Table.Tr
      className={assignedTo === UNASSIGNED ? styles.unassigned : undefined}
    >
      <Table.Td>
        <NativeSelect
          size="xs"
          value={assignedTo}
          onChange={(e) => onAssign(e.currentTarget.value)}
          data={[
            { value: UNASSIGNED, label: "—" },
            ...meta.players.map((player, idx) => ({
              value: player.id,
              label: playerDisplayName(player, idx),
            })),
          ]}
        />
      </Table.Td>
      <Table.Td>
        {play.username || (
          <em>{play.gamerId ? `gamer #${play.gamerId}` : "unknown player"}</em>
        )}
      </Table.Td>
      <Table.Td className={styles.numeric}>
        {play.score.toLocaleString()}
        {play.fullCombo && (
          <Badge variant="light" color="green" className={styles.fcTag}>
            FC
          </Badge>
        )}
        {typeof existingScore === "number" &&
          existingScore !== play.score &&
          !isOverwritten && (
            <span className={styles.replaces}>
              was {existingScore.toLocaleString()}
            </span>
          )}
      </Table.Td>
      <Table.Td>
        {chart.nameTranslation || chart.name}{" "}
        <Badge style={{ backgroundColor: chart.diffColor, color: "#fff" }}>
          {chart.diffAbbr} {chart.level}
        </Badge>
      </Table.Td>
      <Table.Td>
        {timeAgo(play.playedAt)}
        {isOverwritten && (
          <Badge
            variant="light"
            color="yellow"
            className={styles.supersededTag}
          >
            superseded
          </Badge>
        )}
      </Table.Td>
    </Table.Tr>
  );
}

/** compact "how long ago", accurate enough for a 5-to-60 minute window */
function timeAgo(when: number | undefined) {
  if (when === undefined) {
    return "unknown";
  }
  const seconds = Math.max(0, Math.round((Date.now() - when) / 1000));
  if (seconds < 60) {
    return `${seconds}s ago`;
  }
  const minutes = Math.round(seconds / 60);
  return minutes < 90 ? `${minutes}m ago` : `${Math.round(minutes / 60)}h ago`;
}
