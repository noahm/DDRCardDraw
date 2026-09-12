import classNames from "classnames";
import { Pill } from "@mantine/core";
import styles from "./card-label.css";
import {
  IconArrowsSplit,
  IconBan,
  IconLock,
  IconCrown,
  IconScribble,
} from "@tabler/icons-react";
import { usePlayerLabelForId } from "./use-player-label";

export enum LabelType {
  Protect = 1,
  Ban,
  Pocket,
  Winner,
  FreePick,
}

interface Props {
  playerId: string;
  type: LabelType;
  onRemove?: () => void;
}

function getColor(type: LabelType) {
  switch (type) {
    case LabelType.Pocket:
      return "blue";
    case LabelType.Ban:
      return "red";
    case LabelType.Protect:
      return "green";
    case LabelType.Winner:
      return "yellow";
    case LabelType.FreePick:
      return "gray";
  }
}

function LabelIcon({ type, ...props }: { type: LabelType; size?: number }) {
  switch (type) {
    case LabelType.Pocket:
      return <IconArrowsSplit {...props} />;
    case LabelType.Ban:
      return <IconBan {...props} />;
    case LabelType.Protect:
      return <IconLock {...props} />;
    case LabelType.Winner:
      return <IconCrown {...props} />;
    case LabelType.FreePick:
      return <IconScribble {...props} />;
  }
}

export function CardLabel({ playerId, type, onRemove }: Props) {
  const label = usePlayerLabelForId(playerId);
  const color = getColor(type);

  const rootClassname = classNames(styles.cardLabel, {
    [styles.winner]: type === LabelType.Winner,
  });

  return (
    <div className={rootClassname}>
      <Pill
        size="md"
        bg={`var(--mantine-color-${color}-filled)`}
        c="var(--mantine-color-white)"
        classNames={{
          root: styles.pill,
          label: styles.pillLabel,
          remove: styles.pillRemove,
        }}
        withRemoveButton={!!onRemove}
        onRemove={onRemove}
        removeButtonProps={{
          // Pill keeps its remove button out of the tab order and hides it from
          // assistive tech, because inside a PillsInput the surrounding input
          // owns both. Here the button is the only way to undo the action, so
          // it has to be reachable and named on its own.
          "aria-hidden": false,
          tabIndex: 0,
          "aria-label": `Remove ${label}`,
        }}
      >
        <LabelIcon type={type} size={14} />
        {label}
      </Pill>
    </div>
  );
}
