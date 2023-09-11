import classNames from "classnames";
import React from "react";
import { Intent, Tag } from "@blueprintjs/core";
import styles from "./card-label.css";
import { IconNames } from "@blueprintjs/icons";
import { usePlayerLabel } from "./use-player-label";

export enum LabelType {
  Protect = 1,
  Ban,
  Pocket,
  Winner,
}

interface Props {
  player: number;
  type: LabelType;
  onRemove?: () => void;
}

function getIntent(type: LabelType) {
  switch (type) {
    case LabelType.Pocket:
      return Intent.PRIMARY;
    case LabelType.Ban:
      return Intent.DANGER;
    case LabelType.Protect:
      return Intent.SUCCESS;
    case LabelType.Winner:
      return Intent.WARNING;
  }
}

function getIcon(type: LabelType) {
  switch (type) {
    case LabelType.Pocket:
      return IconNames.INHERITANCE;
    case LabelType.Ban:
      return IconNames.BAN_CIRCLE;
    case LabelType.Protect:
      return IconNames.LOCK;
    case LabelType.Winner:
      return IconNames.Crown;
  }
}

export function CardLabel({ player, type, onRemove }: Props) {
  const label = usePlayerLabel(player);

  const rootClassname = classNames(styles.cardLabel, {
    [styles.winner]: type === LabelType.Winner,
  });
  return (
    <div className={rootClassname}>
      <Tag
        intent={getIntent(type)}
        icon={getIcon(type)}
        large
        onRemove={onRemove}
      >
        {label}
      </Tag>
    </div>
  );
}
