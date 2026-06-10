import classNames from "classnames";
import { Badge, CloseButton } from "@mantine/core";
import styles from "./card-label.css";
import {
  IconArrowsSplit,
  IconBan,
  IconLock,
  IconCrown,
  IconScribble,
} from "@tabler/icons-react";
import { usePlayerLabelForIndex } from "./use-player-label";

export enum LabelType {
  Protect = 1,
  Ban,
  Pocket,
  Winner,
  FreePick,
}

interface Props {
  playerIdx: number;
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

export function CardLabel({ playerIdx, type, onRemove }: Props) {
  const label = usePlayerLabelForIndex(playerIdx);

  const rootClassname = classNames(styles.cardLabel, {
    [styles.winner]: type === LabelType.Winner,
  });

  return (
    <div className={rootClassname}>
      <Badge
        color={getColor(type)}
        variant="filled"
        size="lg"
        radius="sm"
        style={{ textTransform: "none" }}
        leftSection={<LabelIcon type={type} size={16} />}
        rightSection={
          onRemove ? (
            <CloseButton
              size="xs"
              variant="transparent"
              style={{ color: "inherit" }}
              onClick={(e) => {
                e.stopPropagation();
                onRemove();
              }}
            />
          ) : undefined
        }
      >
        {label}
      </Badge>
    </div>
  );
}
