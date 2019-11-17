import styles from "./icon.css";

export function Icon({ src, title }) {
  return (
    <figure
      title={title}
      alt={title}
      dangerouslySetInnerHTML={{ __html: src }}
      className={styles.icon}
    />
  );
}
