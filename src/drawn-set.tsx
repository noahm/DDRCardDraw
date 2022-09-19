import { memo, useEffect, useState } from "react";
import { SongCard } from "./song-card";
import styles from "./drawn-set.css";
import { Drawing } from "./models/Drawing";
import { useDrawState } from "./draw-state";
import { SetLabels } from "./tournament-mode/drawing-labels";
import {
  DrawingProvider,
  useDrawing,
  useDrawingStore,
} from "./drawing-context";
import { NetworkingActions } from "./tournament-mode/networking-actions";
import { syncStoreWithPeer } from "./zustand/shared-zustand";

function SyncWithPeers() {
  const drawing = useDrawing();
  const store = useDrawingStore();
  useEffect(() => {
    if (drawing.__syncPeers) {
      const cleanups = drawing.__syncPeers.map((peer) =>
        syncStoreWithPeer(store, peer)
      );
      return () => {
        for (const cleanup of cleanups) {
          cleanup();
        }
      };
    }
  }, [drawing.__syncPeers]);

  return null;
}

const HUE_STEP = (255 / 8) * 3;
let hue = Math.floor(Math.random() * 255);

function getRandomGradiant() {
  hue += HUE_STEP;
  return `linear-gradient(hsl(${hue}, var(--drawing-grad-saturation), var(--drawing-grad-lightness)), transparent, transparent)`;
}

interface Props {
  drawing: Drawing;
}

function DrawnSetImpl({ drawing }: Props) {
  const [backgroundImage] = useState(getRandomGradiant());

  return (
    <DrawingProvider initialDrawing={drawing}>
      <SyncWithPeers />
      <div
        key={drawing.id}
        style={{ backgroundImage }}
        className={styles.drawing}
      >
        <SetLabels />
        <NetworkingActions />
        <ChartList />
      </div>
    </DrawingProvider>
  );
}

function ChartList() {
  const charts = useDrawing((d) => d.charts);
  return (
    <div className={styles.chartList}>
      {charts.map((c) => (
        <ChartFromContext key={c.id} chartId={c.id} />
      ))}
    </div>
  );
}

function ChartFromContext({ chartId }: { chartId: number }) {
  const chart = useDrawing((d) => d.charts.find((c) => c.id === chartId));
  const veto = useDrawing((d) => d.bans.find((b) => b.chartId === chartId));
  const protect = useDrawing((d) =>
    d.protects.find((b) => b.chartId === chartId)
  );
  const pocketPick = useDrawing((d) =>
    d.pocketPicks.find((b) => b.chartId === chartId)
  );
  if (!chart) {
    return null;
  }
  return (
    <SongCard
      vetoedBy={veto && veto.player}
      protectedBy={protect && protect.player}
      replacedBy={pocketPick && pocketPick.player}
      replacedWith={pocketPick && pocketPick.pick}
      chart={chart}
      actionsEnabled
    />
  );
}

const DrawnSet = memo(DrawnSetImpl);

export default DrawnSet;
