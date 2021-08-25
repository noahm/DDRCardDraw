import { useContext } from "preact/hooks";
import { DrawnSet } from "./drawn-set";
import styles from "./drawing-list.css";
import { DrawStateContext } from "./draw-state";
import { Drawing } from "./models/Drawing";
import { memo } from "preact/compat/src";
import { ConfigStateContext } from "./config-state";
import { filterChartsToSongs } from "./card-draw";
import { SongCard } from "./song-card";

const renderDrawing = (drawing: Drawing) => (
  <DrawnSet key={drawing.id} drawing={drawing} />
);

const ScrollableDrawings = memo((props: { drawings: Drawing[] }) => {
  return (
    <div className={styles.scrollable}>{props.drawings.map(renderDrawing)}</div>
  );
});

export function DrawingList() {
  const { drawings, gameData } = useContext(DrawStateContext);
  const configState = useContext(ConfigStateContext);
  if (configState.showPool && gameData) {
    const charts = Array.from(filterChartsToSongs(configState, gameData.songs));
    return (
      <div className={styles.scrollable}>
        <div className={styles.chartList}>
          {charts.map((chart, index) => (
            <SongCard chart={chart} key={index} />
          ))}
        </div>
      </div>
    );
  }
  return <ScrollableDrawings drawings={drawings} />;
}
