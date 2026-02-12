import React from "react";
import {
  EligibleChart,
  DrawnChart,
  PlayerPickPlaceholder,
  CHART_PLACEHOLDER,
} from "../../models/Drawing";
import { detectedLanguage } from "../../utils";
import { ChartLevel } from "../chart-level";
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

export function baseChartValues(
  chart: EligibleChart | DrawnChart | PlayerPickPlaceholder,
): Partial<EligibleChart> & { name: string } {
  if ("type" in chart && chart.type === CHART_PLACEHOLDER) {
    return {
      name: "Your Pick Here",
    };
  }
  return chart;
}

export function BaseCardCenter(props: CardSectionProps) {
  const { name, nameTranslation, artist, artistTranslation, dateAdded } =
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
      <div className={styles.dateAdded} title={dateAdded}>
        {dateAdded}
      </div>
    </>
  );
}

export interface BaseFooterProps extends CardSectionProps {
  centerElement?: React.ReactNode;
}

export function BaseCardFooter(props: BaseFooterProps) {
  const { diffColor, diffAbbr, bpm } = baseChartValues(props.chart);
  return (
    <div className={styles.cardFooter} style={{ backgroundColor: diffColor }}>
      {bpm ? <div>{bpm} BPM</div> : <div />}
      {props.centerElement}
      <div className={styles.difficulty}>
        {diffAbbr} <ChartLevel chart={props.chart} />
      </div>
    </div>
  );
}
