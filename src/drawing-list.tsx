import { memo } from "react";
import { DrawnSet } from "./drawn-set";
import styles from "./drawing-list.css";
import { useDrawState } from "./draw-state";
import { Drawing } from "./models/Drawing";
import { useConfigState } from "./config-state";
import { EligibleChartsList } from "./eligible-charts-list";
import { Callout, NonIdealState } from "@blueprintjs/core";
import { IconNames } from "@blueprintjs/icons";
import logo from "./assets/rednote.png";

const renderDrawing = (drawing: Drawing) => (
  <DrawnSet key={drawing.id} drawing={drawing} />
);

const ScrollableDrawings = memo((props: { drawings: Drawing[] }) => {
  return <div>{props.drawings.map(renderDrawing)}</div>;
});

export function DrawingList() {
  const drawings = useDrawState((s) => s.drawings);
  const showPool = useConfigState((cfg) => cfg.showPool);
  if (showPool) {
    return <EligibleChartsList />;
  }
  if (!drawings.length) {
    return (
      <div className={styles.empty}>
        <NonIdealState
          icon={<img src={logo} height={128} />}
          title="Red Note SMX Card Draw"
          action={
            <Callout intent="danger" icon={IconNames.ArrowTopLeft}>
              Choose a tournament round, then click 'Draw'
            </Callout>
          }
        />
      </div>
    );
  }
  return <ScrollableDrawings drawings={drawings} />;
}
