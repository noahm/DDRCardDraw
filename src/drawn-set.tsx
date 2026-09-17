import { memo } from "react";
import { ErrorBoundary } from "react-error-boundary";
import { SongCard } from "./song-card";
import styles from "./drawn-set.css";
import { useDrawing } from "./drawing-context";
import { useEventSettings } from "./state/hooks";
import { DrawingActions } from "./tournament-mode/drawing-actions";
import { ErrorFallback } from "./utils/error-fallback";

/**
 * expects a drawing context wrapper
 **/
export function ChartList() {
  const charts = useDrawing((d) => d.charts);
  if (!charts) return null;
  return (
    <div className={styles.chartList}>
      {charts.map((c) => (
        <ChartFromContext key={c.id} chartId={c.id} />
      ))}
    </div>
  );
}

function ChartFromContext({ chartId }: { chartId: string }) {
  const chart = useDrawing((d) => d.charts.find((c) => c.id === chartId));
  const veto = useDrawing((d) => {
    return d.bans[chartId];
  });
  const protect = useDrawing((d) => d.protects[chartId]);
  const pocketPick = useDrawing((d) => d.pocketPicks[chartId]);
  const winner = useDrawing((d) => d.winners[chartId]);
  const hideVetos = useEventSettings((s) => s.hideVetos);
  if (!chart) {
    return null;
  }
  /*
   * A hidden veto has to leave the tree rather than be styled out of sight.
   * Every card sits in a popover target wrapper of its own, and that wrapper is
   * a `flex: 1 0 0` child of the chart list. Hiding just the card leaves the
   * wrapper behind as an empty flex item that still claims its share of the
   * row: a hole in the layout, and narrower cards on whichever rows hold one.
   * A merged multi-set draw shows it worst, since every sub-draw's cards share
   * one wrapping list and re-ordering piles the bans up at the end of it.
   */
  if (hideVetos && veto) {
    return null;
  }
  return (
    <SongCard
      vetoedBy={veto?.player}
      protectedBy={protect?.player}
      replacedBy={pocketPick?.player}
      replacedWith={pocketPick?.pick}
      winner={winner}
      chart={chart}
      actionsEnabled
    />
  );
}

function TournamentModeSpacer() {
  return <div style={{ height: "15px" }} />;
}

const DrawnSet = memo(function DrawnSet() {
  const [, drawingId] = useDrawing((d) => d.compoundId);

  return (
    <ErrorBoundary
      fallback={
        <div
          className={styles.drawing}
          style={{
            padding: "2em",
            minHeight: "15em",
            display: "flex",
            justifyContent: "center",
          }}
        >
          <ErrorFallback />
        </div>
      }
    >
      <div
        key={drawingId}
        id={`drawing:${drawingId}`}
        className={styles.drawing}
      >
        <TournamentModeSpacer />
        <div id={`drawing-${drawingId}`}>
          <ChartList />
        </div>
        <DrawingActions />
      </div>
    </ErrorBoundary>
  );
});

export default DrawnSet;
