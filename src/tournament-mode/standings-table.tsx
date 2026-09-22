import { Badge, Table } from "@mantine/core";
import { useDrawing } from "../drawing-context";
import { type GauntletScoredMeta } from "../models/Drawing";
import {
  computeGauntletStandings,
  playableCharts,
} from "../models/gauntlet-standings";
import { useEventSettings } from "../state/hooks";
import styles from "./standings-table.css";

/**
 * The gauntlet standings for the draw in context, for reading in the app
 * itself. The OBS source in `../obs-sources/standings` shows the same numbers
 * styled for an overlay; this one is a plain table meant to sit in a dialog
 * next to the grid the scores were typed into.
 */
export function StandingsTable({ meta }: { meta: GauntletScoredMeta }) {
  // standings cover the whole round, not just the sub-draw this dialog was
  // opened from, so they agree with the match labels and the OBS overlay
  const subDrawings = useDrawing((d) => d.subDrawings);
  const bans = useDrawing((d) => d.bans);
  const pocketPicks = useDrawing((d) => d.pocketPicks);
  const eventScheme = useEventSettings((s) => s.gauntletPayout);

  const standings = computeGauntletStandings(
    meta,
    playableCharts({ subDrawings, bans, pocketPicks }),
    eventScheme,
  );
  const { playedCharts, pointsPerPlace, rows } = standings;

  if (!playedCharts.length) {
    return (
      <p className={styles.empty}>
        No scores yet. Standings appear as soon as a song has one.
      </p>
    );
  }

  return (
    <div className={styles.standings}>
      <Table striped verticalSpacing={4}>
        <thead>
          <tr>
            <th>#</th>
            <th>Player</th>
            {playedCharts.map(({ id, chart }) => (
              <th key={id} className={styles.songHeading}>
                {chart.nameTranslation || chart.name}
              </th>
            ))}
            <th className={styles.numeric}>Points</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.player.id}>
              <td className={styles.rank}>{row.place}</td>
              <td>{row.name}</td>
              {playedCharts.map(({ id }) => {
                const result = row.results[id];
                return (
                  <td key={id} className={styles.numeric}>
                    {result ? (
                      <>
                        <span className={styles.score}>
                          {result.score.toLocaleString()}
                        </span>
                        <Badge
                          variant="light"
                          color={result.points ? "green" : "gray"}
                        >
                          {result.points}
                        </Badge>
                      </>
                    ) : (
                      <span className={styles.unplayed}>—</span>
                    )}
                  </td>
                );
              })}
              <td className={`${styles.numeric} ${styles.total}`}>
                {row.totalPoints}
              </td>
            </tr>
          ))}
        </tbody>
      </Table>
      <p className={styles.payout}>
        paying {pointsPerPlace.join(", ")} by place
      </p>
    </div>
  );
}
