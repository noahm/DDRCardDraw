import classNames from "classnames";
import styles from "./card-label.css";
import { FunctionalComponent } from "preact";

interface Props {
  left?: boolean;
}

export const CardLabel: FunctionalComponent<Props> = ({ children, left }) => {
  const c = classNames(styles.cardLabel, {
    [styles.left]: left
  });
  return (
    <div className={c}>
      <span>{children}</span>
    </div>
  );
};
