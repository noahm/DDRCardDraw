import classNames from "classnames";
import React from "react";
import { Intent, Tag } from "@blueprintjs/core";
import styles from "./card-label.css";
import { IconNames } from "@blueprintjs/icons";

export enum LabelType {
  Protect = 1,
  Ban,
  Pocket,
}

interface Props {
  player: 1 | 2;
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
  }
}

export function CardLabel({ player, type, onRemove }: Props) {
  return (
    <div className={styles.cardLabel}>
      <Tag
        intent={getIntent(type)}
        icon={getIcon(type)}
        large
        onRemove={onRemove}
      >
        P{player}
      </Tag>
    </div>
  );
}
