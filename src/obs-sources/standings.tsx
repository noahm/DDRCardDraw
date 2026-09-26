import classNames from "classnames";
import { useMemo } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { type EligibleChart, isGauntletScored } from "../models/Drawing";
import {
  computeGauntletStandings,
  playableCharts,
  type ChartResult,
} from "../models/gauntlet-standings";
import { ordinalPlace } from "../models/payout-scheme";
import { useEventSettings } from "../state/hooks";
import { useAppState } from "../state/store";
import { getJacketUrl } from "../utils/jackets";
import { toStandingsOptions } from "./standings-options";
import styles from "./standings.css";

/**
 * Live standings for the gauntlet on a cab: players down the left sorted by
 * points, one column per song that's been played, and running totals on the
 * right. The url can ask for a column for every song drawn instead, and say
 * whether a pocket or free pick names the player who picked it (see
 * `./standings-options`).
 *
 * Renders nothing for a cab with no match, or one holding a head to head draw,
 * which scores by per-chart wins rather than points and so has no standings to
 * show. A custom draw of more than two players is a gauntlet in all but name
 * and gets the same table.
 */
export function CabStandings() {
  const params = useParams<"roomName" | "cabId">();
  const [searchParams] = useSearchParams();
  const options = toStandingsOptions(searchParams);
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
  const { rows } = standings;
  const columns =
    options.songs === "all" ? standings.charts : standings.playedCharts;
  const nameOf = new Map(rows.map((row) => [row.player.id, row.name]));

  return (
    <table className={styles.standings}>
      <thead>
        <tr>
          <th className={styles.corner} colSpan={2} />
          {columns.map(({ id, chart, pickedBy }) => (
            <SongHeading
              key={id}
              chart={chart}
              pickedBy={
                options.pickers === "show" && pickedBy
                  ? nameOf.get(pickedBy)
                  : undefined
              }
            />
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
            {columns.map(({ id }) => (
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

function SongHeading({
  chart,
  pickedBy,
}: {
  chart: EligibleChart;
  /** display name of the player who pocket or free picked this song */
  pickedBy?: string;
}) {
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
      {pickedBy && (
        <span className={styles.picker} data-field="picker">
          {pickedBy}
        </span>
      )}
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
        })}
        data-field="placing"
      >
        <span data-field="place">{ordinalPlace(result.place)}</span>
        {", "}
        <span
          className={result.points ? styles.points : styles.noPoints}
          data-field="points"
        >{`+${result.points}`}</span>
      </span>
    </td>
  );
}
