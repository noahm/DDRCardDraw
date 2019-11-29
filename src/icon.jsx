import classNames from "classnames";
import styles from "./icon.css";

export function Icon({ src, title, onClick }) {
  return (
    <figure
      title={title}
      alt={title}
      dangerouslySetInnerHTML={{ __html: src }}
      className={classNames(styles.icon, { [styles.clickable]: !!onClick })}
      onClick={onClick}
    />
  );
}
