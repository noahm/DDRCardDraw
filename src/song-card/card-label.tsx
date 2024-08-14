import classNames from "classnames";
import React from "react";
import { Intent, Tag } from "@blueprintjs/core";
import styles from "./card-label.css";
import { Inheritance, BanCircle, Lock, Crown, Draw } from "@blueprintjs/icons";
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
    case LabelType.FreePick:
      return Intent.NONE;
  }
}

function getIcon(type: LabelType) {
  switch (type) {
    case LabelType.Pocket:
      return Inheritance;
    case LabelType.Ban:
      return BanCircle;
    case LabelType.Protect:
      return Lock;
    case LabelType.Winner:
      return Crown;
    case LabelType.FreePick:
      return Draw;
  }
}

export function CardLabel({ playerIdx, type, onRemove }: Props) {
  const label = usePlayerLabelForIndex(playerIdx);

  const rootClassname = classNames(styles.cardLabel, {
    [styles.winner]: type === LabelType.Winner,
  });

  const LabelIcon = getIcon(type);

  return (
    <div className={rootClassname}>
      <Tag
        intent={getIntent(type)}
        icon={<LabelIcon size={20} />}
        large
        onRemove={onRemove}
      >
        {label}
      </Tag>
    </div>
  );
}
