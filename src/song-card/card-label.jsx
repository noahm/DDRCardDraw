import styles from "./card-label.css";

export function CardLabel({ children }) {
  return (
    <div className={styles.cardLabel}>
      <span>{children}</span>
    </div>
  );
}
