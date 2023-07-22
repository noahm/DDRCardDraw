import { memo, useEffect, useRef, useState } from "react";
import { SongCard } from "./song-card";
import styles from "./drawn-set.css";
import { Drawing } from "./models/Drawing";
import { SetLabels } from "./tournament-mode/drawing-labels";
import { DrawingProvider, useDrawing } from "./drawing-context";
import { NetworkingActions } from "./tournament-mode/networking-actions";
import { SyncWithPeers } from "./tournament-mode/sync-with-peers";
import { useConfigState } from "./config-state";
import { useDrawState } from "./draw-state";

const HUE_STEP = (255 / 8) * 3;
let hue = Math.floor(Math.random() * 255);

function getRandomGradiant() {
  hue += HUE_STEP;
  return `linear-gradient(hsl(${hue}, var(--drawing-grad-saturation), var(--drawing-grad-lightness)), transparent, transparent)`;
}

interface Props {
  drawing: Drawing;
}

function ChartList() {
  const charts = useDrawing((d) => d.charts);
  return (
    <div className={styles.chartList}>
      {charts.map((c) => (
        <ChartFromContext key={c.id} chartIdx={c.id} />
      ))}
    </div>
  );
}

function ChartFromContext({ chartIdx }: { chartIdx: number }) {
  const chart = useDrawing((d) => d.charts.find((c) => c.id === chartIdx));
  const veto = useDrawing((d) => d.bans.find((b) => b.chartId === chartIdx));
  const protect = useDrawing((d) =>
    d.protects.find((b) => b.chartId === chartIdx)
  );
  const pocketPick = useDrawing((d) =>
    d.pocketPicks.find((b) => b.chartId === chartIdx)
  );
  const winner = useDrawing((d) =>
    d.winners.find((b) => b.chartId === chartIdx)
  );
  const markRevealed = useDrawing((d) => d.markRevealed);
  const autoReveal = useDrawing((d) => d.autoReveal);
  if (!chart) {
    return null;
  }
  return (
    <SongCard
      vetoedBy={veto?.player}
      protectedBy={protect?.player}
      replacedBy={pocketPick?.player}
      replacedWith={pocketPick?.pick}
      winner={winner?.player}
      chart={chart}
      actionsEnabled
      animateDelay={500 * (chartIdx + 1)}
      autoReveal={autoReveal}
      conceal={chart.conceal}
      onReveal={() => markRevealed(chartIdx)}
    />
  );
}

function TournamentModeSpacer() {
  const showLabels = useConfigState((s) => s.showLabels);
  if (showLabels) {
    return null;
  }
  return <div style={{ height: "15px" }} />;
}

const DrawnSet = memo<Props>(function DrawnSet({ drawing }) {
  const [backgroundImage] = useState(getRandomGradiant());

  return (
    <DrawingProvider initialDrawing={drawing}>
      <SyncWithPeers />
      <SyncUpWhenUnmounted />
      <div
        key={drawing.id}
        style={{ backgroundImage }}
        className={styles.drawing}
      >
        <TournamentModeSpacer />
        <div id={`drawing-${drawing.id}`}>
          <SetLabels />
          <ChartList />
        </div>
        <NetworkingActions />
      </div>
    </DrawingProvider>
  );
});

function SyncUpWhenUnmounted() {
  const d = useDrawing();
  const drawingRef = useRef(d);
  drawingRef.current = d;

  useEffect(() => {
    return () => {
      useDrawState.setState((state) => {
        const currentIdx = state.drawings.findIndex(
          (d) => d.id === drawingRef.current.id
        );
        const nextDrawings = state.drawings.slice();
        nextDrawings[currentIdx] = drawingRef.current;
        return { drawings: nextDrawings };
      });
    };
  }, []);

  return null;
}

export default DrawnSet;
