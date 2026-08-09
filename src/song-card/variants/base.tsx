import React from "react";
import {
  EligibleChart,
  DrawnChart,
  PlayerPickPlaceholder,
  CHART_PLACEHOLDER,
} from "../../models/Drawing";
import { useIntl } from "../../hooks/useIntl";
import { detectedLanguage } from "../../utils";
import { ChartLevel } from "../chart-level";
import styles from "../song-card.css";
import { useConfigState } from "../../config-state";

const isJapanese = detectedLanguage === "ja";

/** Props passed into the main song card component to provide implementations of main visual content */
export interface CardContentsProps {
  CenterContent: React.ComponentType<CardSectionProps>;
  FooterContent: React.ComponentType<CardSectionProps>;
  /**
   * Optionally surface extra, game-specific info popovers for a given chart
   * (e.g. a QR code for an SMX edit). The card renders each returned action as a
   * menu item that, when chosen, shows its `content` in a popover on the card.
   */
  getActions?: (chart: CardSectionProps["chart"]) => CardAction[];
}

/** Props passed to child components that get to customize card center and footer content */
export interface CardSectionProps {
  chart: EligibleChart | DrawnChart | PlayerPickPlaceholder;
}

/**
 * An extra, game-specific informational action a card variant can contribute to
 * a card's menu. Selecting it opens `content` in a popover anchored to the card.
 */
export interface CardAction {
  /** stable identifier, unique among a variant's actions for one chart */
  key: string;
  /** i18n key for the menu item's label (e.g. a `meta.*` key from the game data) */
  labelKey: string;
  /** fallback label text if `labelKey` isn't found in the active translations */
  labelDefault?: string;
  /** menu item icon */
  icon?: React.JSX.Element;
  /** content rendered in a popover anchored to the card when this action is chosen */
  content: React.JSX.Element;
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

export function MaxScoreCardCenter(props: CardSectionProps) {
  const { name, nameTranslation, artist, artistTranslation, maxScore } =
    baseChartValues(props.chart);
  const { t } = useIntl();
  const showMaxScore = useConfigState((state) => state.showMaxScore);
  const maxExScore = t(
    "meta.maxScoreFormat",
    { maxScore: maxScore ?? "no data" },
    "MAX: {maxScore}",
  );

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
      {showMaxScore ? (
        <div className={styles.maxScore} title={maxExScore}>
          {maxExScore}
        </div>
      ) : null}
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
