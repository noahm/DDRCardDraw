import { CardSectionProps, baseChartValues } from "./base";
import { detectedLanguage } from "../../utils";
import styles from "../song-card.css";

const isJapanese = detectedLanguage === "ja";

/**
 * Like the base card center, but adds the edit chart's author on a line below
 * the song artist when present.
 */
export function SmxCardCenter(props: CardSectionProps) {
  const {
    name,
    nameTranslation,
    artist,
    artistTranslation,
    dateAdded,
    author,
  } = baseChartValues(props.chart);
  return (
    <>
      <div className={styles.name} title={nameTranslation}>
        {name}
      </div>
      {isJapanese ? null : (
        <div className={styles.nameTranslation}>{nameTranslation}</div>
      )}
      <div className={styles.artist} title={artistTranslation}>
        {artist}
      </div>
      {author && (
        <div className={styles.editAuthor} title="Edit author">
          edit by {author}
        </div>
      )}
      <div className={styles.dateAdded} title={dateAdded}>
        {dateAdded}
      </div>
    </>
  );
}
