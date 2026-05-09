import { Offline } from "@blueprintjs/icons";
import { useIntl } from "../../hooks/useIntl";
import { detectedLanguage } from "../../utils";
import styles from "../song-card.css";
import { BaseCardFooter, CardSectionProps, baseChartValues } from "./base";
import ddrStyles from "./ddr.css";
import { useConfigState } from "../../config-state";

const isJapanese = detectedLanguage === "ja";

export function DdrCardCenter(props: CardSectionProps) {
  const {
    name,
    nameTranslation,
    artist,
    artistTranslation,
    step,
    freeze,
    shock,
  } = baseChartValues(props.chart);
  const showMaxScore = useConfigState((state) => state.showMaxScore);
  const maxExScore = `EX: ${step ? (step + (freeze ?? 0) + (shock ?? 0)) * 3 : "no data"}`;

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
        <div className={ddrStyles.exScore} title={maxExScore}>
          {maxExScore}
        </div>
      ) : null}
    </>
  );
}

export function DdrCardFooter(props: CardSectionProps) {
  const { flags } = baseChartValues(props.chart);
  const { t } = useIntl();
  return (
    <BaseCardFooter
      chart={props.chart}
      centerElement={
        flags?.includes("shock") && (
          <div className={ddrStyles.shockBadge}>
            <Offline title={t("controls.shockArrows")} size={14} />
          </div>
        )
      }
    />
  );
}
