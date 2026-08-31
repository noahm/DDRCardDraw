import classNames from "classnames";
import React from "react";
import { Intent, Tag } from "@blueprintjs/core";
import styles from "./card-label.css";
import {
  Inheritance,
  BanCircle,
  Lock,
  Crown,
  Draw,
  SVGIconProps,
} from "@blueprintjs/icons";
import { usePlayerLabel } from "./use-player-label";

export enum LabelType {
  Protect = 1,
  Ban,
  Pocket,
  Winner,
  FreePick,
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
    case LabelType.FreePick:
      return Intent.NONE;
  }
}

function LabelIcon({ type, ...props }: SVGIconProps & { type: LabelType }) {
  switch (type) {
    case LabelType.Pocket:
      return <Inheritance {...props} />;
    case LabelType.Ban:
      return <BanCircle {...props} />;
    case LabelType.Protect:
      return <Lock {...props} />;
    case LabelType.Winner:
      return <Crown {...props} />;
    case LabelType.FreePick:
      return <Draw {...props} />;
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
        icon={<LabelIcon type={type} size={20} />}
        size="large"
        onRemove={onRemove}
      >
        {label}
      </Tag>
    </div>
  );
}
