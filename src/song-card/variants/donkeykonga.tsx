import React from "react";
import {
  EligibleChart,
  DrawnChart,
  PlayerPickPlaceholder,
  CHART_PLACEHOLDER,
} from "../../models/Drawing";
import { detectedLanguage } from "../../utils";
import styles from "../song-card.css";

const isJapanese = detectedLanguage === "ja";

/** Props passed into the main song card component to provide implementations of main visual content */
export interface CardContentsProps {
  CenterContent: React.ComponentType<CardSectionProps>;
  FooterContent: React.ComponentType<CardSectionProps>;
}

/** Props passed to child components that get to customize card center and footer content */
export interface CardSectionProps {
  chart: EligibleChart | DrawnChart | PlayerPickPlaceholder;
}

export function donkeyKongaChartValues(
  chart: EligibleChart | DrawnChart | PlayerPickPlaceholder,
): Partial<EligibleChart> & { name: string } {
  if ("type" in chart && chart.type === CHART_PLACEHOLDER) {
    return {
      name: "Your Pick Here",
    };
  }
  return chart;
}

export function DonkeyKongaCardCenter(props: CardSectionProps) {
  const { name, nameTranslation, artist, artistTranslation, folder } =
    donkeyKongaChartValues(props.chart);
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