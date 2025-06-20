import { memo, useState } from "react";
import { ErrorBoundary } from "react-error-boundary";
import { SongCard } from "./song-card";
import styles from "./drawn-set.css";
import { useDrawing } from "./drawing-context";
import { DrawingActions } from "./tournament-mode/drawing-actions";
import { ErrorFallback } from "./utils/error-fallback";
import { useAtomValue } from "jotai";
import { showPlayerAndRoundLabels } from "./config-state";
import { EligibleChart } from "./models/Drawing";

const HUE_STEP = (255 / 8) * 3;
let hue = Math.floor(Math.random() * 255);

function getRandomGradiant() {
  hue += HUE_STEP;
  return `linear-gradient(hsl(${hue}, var(--drawing-grad-saturation), var(--drawing-grad-lightness)), transparent, transparent)`;
}

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

export function RawChartList(props: { charts: Array<EligibleChart> }) {
  return (
    <div className={styles.chartList}>
      {props.charts.map((c, idx) => (
        <SongCard key={idx} chart={c} />
      ))}
    </div>
  );
}

function ChartFromContext({ chartId }: { chartId: string }) {
  const chart = useDrawing((d) => d.charts.find((c) => c.id === chartId));
  const veto = useDrawing((d) => d.bans[chartId]);
  const protect = useDrawing((d) => d.protects[chartId]);
  const pocketPick = useDrawing((d) => d.pocketPicks[chartId]);
  const winner = useDrawing((d) => d.winners[chartId]);
  if (!chart) {
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
  const showLabels = useAtomValue(showPlayerAndRoundLabels);
  if (showLabels) {
    return null;
  }
  return <div style={{ height: "15px" }} />;
}

const DrawnSet = memo(function DrawnSet() {
  const [backgroundImage] = useState(getRandomGradiant());
  const drawingId = useDrawing((d) => d.id);

  return (
    <ErrorBoundary
      fallback={
        <div
          className={styles.drawing}
          style={{
            backgroundImage,
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
        style={{ backgroundImage }}
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
