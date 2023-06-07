import { memo } from "react";
import { DrawnSet } from "./drawn-set";
import styles from "./drawing-list.css";
import { useDrawState } from "./draw-state";
import { Drawing } from "./models/Drawing";
import { showPool as showPoolAtom } from "./config-state";
import { EligibleChartsList } from "./eligible-charts-list";
import { Callout, NonIdealState } from "@blueprintjs/core";
import { IconNames } from "@blueprintjs/icons";
import logo from "./assets/ddr-tools-256.png";
import { useRecoilValue } from "recoil";

const renderDrawing = (drawing: Drawing) => (
  <DrawnSet key={drawing.id} drawing={drawing} />
);

const ScrollableDrawings = memo((props: { drawings: Drawing[] }) => {
  return <div>{props.drawings.map(renderDrawing)}</div>;
});

export function DrawingList() {
  const drawings = useDrawState((s) => s.drawings);
  const showPool = useRecoilValue(showPoolAtom);
  if (showPool) {
    return <EligibleChartsList />;
  }
  if (!drawings.length) {
    return (
      <div className={styles.empty}>
        <NonIdealState
          icon={<img src={logo} height={128} />}
          title="DDR Tools"
          description="Click 'Draw' above to draw some songs at random. Chose from other games in the top left menu."
          action={<Callout icon={IconNames.HEART}>Dance with pride!</Callout>}
        />
      </div>
    );
  }
  return <ScrollableDrawings drawings={drawings} />;
}
