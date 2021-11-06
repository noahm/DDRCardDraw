import classNames from "classnames";
import styles from "./card-label.css";
import { FC } from "react";

interface Props {
  left?: boolean;
}

export const CardLabel: FC<Props> = ({ children, left }) => {
  const c = classNames(styles.cardLabel, {
    [styles.left]: left,
  });
  return (
    <div className={c}>
      <span>{children}</span>
    </div>
  );
};
