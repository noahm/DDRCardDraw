import * as classNames from "classnames";
import styles from "./card-label.css";

export function CardLabel({ children, left }) {
  const c = classNames(styles.cardLabel, {
    [styles.left]: left
  });
  return (
    <div className={c}>
      <span>{children}</span>
    </div>
  );
}
