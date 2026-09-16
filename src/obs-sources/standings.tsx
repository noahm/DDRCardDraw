import classNames from "classnames";
import { useMemo } from "react";
import { useParams } from "react-router-dom";
import {
  type Drawing,
  type EligibleChart,
  isGauntletScored,
  type ScoreableChart,
  scoreableCharts,
} from "../models/Drawing";
import {
  computeGauntletStandings,
  type ChartResult,
} from "../models/gauntlet-standings";
import { ordinalPlace } from "../models/payout-scheme";
import { useEventSettings } from "../state/hooks";
import { useAppState } from "../state/store";
import { getJacketUrl } from "../utils/jackets";
import styles from "./standings.css";

/**
 * Live standings for the gauntlet on a cab: players down the left sorted by
 * points, one column per song that's been played, and running totals on the
 * right.
 *
 * Renders nothing for a cab with no match, or one holding a head to head draw,
 * which scores by per-chart wins rather than points and so has no standings to
 * show. A custom draw of more than two players is a gauntlet in all but name
 * and gets the same table.
 */
export function CabStandings() {
  const params = useParams<"roomName" | "cabId">();
  // the cab can hold a whole draw or one sub-draw of it; standings always cover
  // the whole round, so only the parent id matters here
  const drawingId = useAppState((s) => {
    const activeMatch = s.event.cabs[params.cabId!]?.activeMatch;
    if (!activeMatch) return null;
    return typeof activeMatch === "string" ? activeMatch : activeMatch[0];
  });
  const drawing = useAppState((s) =>
    drawingId ? s.drawings.entities[drawingId] : undefined,
  );

  const eventScheme = useEventSettings((s) => s.gauntletPayout);

  const standings = useMemo(() => {
    if (!drawing || !isGauntletScored(drawing.meta)) {
      return null;
    }
    return computeGauntletStandings(
      drawing.meta,
      playableCharts(drawing),
      eventScheme,
    );
  }, [drawing, eventScheme]);

  if (!drawing || !standings?.rows.length) {
    return null;
  }
  const { playedCharts, rows } = standings;

  return (
    <table className={styles.standings}>
      <thead>
        <tr>
          <th className={styles.corner} colSpan={2} />
          {playedCharts.map(({ id, chart }) => (
            <SongHeading key={id} chart={chart} />
          ))}
          <th className={styles.totalHeading} data-field="total-heading">
            Points
          </th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr
            key={row.player.id}
            className={
              // before a single score lands everybody is level on nothing, and
              // highlighting the whole field as joint leaders reads as a bug
              row.place === 1 && row.totalPoints > 0
                ? `${styles.row} ${styles.leader}`
                : styles.row
            }
          >
            <td className={styles.rank} data-field="rank">
              {row.place}
            </td>
            <td className={styles.player} data-field="player">
              <span className={styles.playerName}>{row.name}</span>
            </td>
            {playedCharts.map(({ id }) => (
              <ResultCell key={id} result={row.results[id]} />
            ))}
            <td className={styles.total} data-field="total">
              {row.totalPoints}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/**
 * Every chart a match can be scored on, across all of its sub-draws. Pocket
 * picks and free picks show up as the chart that was actually played, so points
 * are paid out on them the same as on anything else drawn.
 */
function playableCharts(drawing: Drawing): ScoreableChart[] {
  return Object.values(drawing.subDrawings ?? {}).flatMap((subDraw) =>
    scoreableCharts(subDraw.charts, drawing),
  );
}

function SongHeading({ chart }: { chart: EligibleChart }) {
  return (
    <th className={styles.songHeading} data-field="song">
      {chart.jacket ? (
        <img
          className={styles.jacket}
          src={getJacketUrl(chart.jacket)}
          alt=""
        />
      ) : (
        <div className={styles.jacket} />
      )}
      <span className={styles.songName} data-field="song-name">
        {chart.nameTranslation || chart.name}
      </span>
      <span
        className={styles.difficulty}
        data-field="difficulty"
        style={{ color: chart.diffColor }}
      >
        {chart.diffAbbr} {chart.level}
      </span>
    </th>
  );
}

function ResultCell({ result }: { result: ChartResult | undefined }) {
  if (!result) {
    // this player hasn't been scored on a song others already have
    return (
      <td className={styles.unplayed} data-field="result">
        —
      </td>
    );
  }
  return (
    <td data-field="result">
      <span className={styles.score} data-field="score">
        {result.score.toLocaleString()}
      </span>
      {/* where a player came on this song and what that paid, on one line:
          the pair is what makes a total add up on screen */}
      <span
        className={classNames(styles.placing, {
          [styles.won]: result.place === 1,
          [styles.noPoints]: !result.points,
        })}
        data-field="placing"
      >
        <span data-field="place">{ordinalPlace(result.place)}</span>
        {", "}
        <span data-field="points">{`+${result.points}`}</span>
      </span>
    </td>
  );
}
