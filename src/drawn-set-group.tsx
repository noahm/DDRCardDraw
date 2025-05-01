import DrawnSet from "./drawn-set";
import { useAppState } from "./state/store";
import { SetLabels } from "./tournament-mode/drawing-labels";

export default function DrawnSetGroup(props: { drawingGroupId: string }) {
  const drawingGroup = useAppState(
    (s) => s.drawingGroups.entities[props.drawingGroupId],
  );
  return (
    <div>
      <SetLabels drawingGroupId={props.drawingGroupId} />
      {drawingGroup.drawingIds.map((drawingId) => (
        <DrawnSet drawingId={drawingId} key={drawingId} />
      ))}
    </div>
  );
}
