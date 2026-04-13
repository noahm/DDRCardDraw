import React from "react";
import { detectedLanguage } from "../../utils";
import styles from "../song-card.css";
import { baseChartValues, CardSectionProps } from "./base";

const isJapanese = detectedLanguage === "ja";

export function DonkeyKongaCardCenter(props: CardSectionProps) {
  const { name, nameTranslation, artist, artistTranslation, folder } =
    baseChartValues(props.chart);
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
      <div className={styles.folder} title={folder}>
        {folder}
      </div>
    </>
  );
}
