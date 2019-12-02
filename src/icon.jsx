import classNames from "classnames";
import styles from "./icon.css";

export function Icon({ svg, title, onClick, className }) {
  return (
    <figure
      title={title}
      alt={title}
      className={classNames(styles.icon, className, {
        [styles.clickable]: !!onClick
      })}
      onClick={onClick}
    >
      {svg}
    </figure>
  );
}
