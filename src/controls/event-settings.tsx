import { Callout, Card, Checkbox } from "@blueprintjs/core";
import { useIntl } from "../hooks/useIntl";
import { selectChartUsage } from "../state/drawings.slice";
import { useEventSettings, useUpdateEventSettings } from "../state/hooks";
import { useAppState } from "../state/store";
import styles from "./controls.css";

/**
 * The event's global settings: one set per room, shared with everyone in it,
 * and deliberately outside the config system. Configs describe *how to build a
 * deck*; these describe rules and display choices that apply to the whole event
 * no matter which config a given draw used. They are also excluded from config
 * sharing for that reason — importing someone's config should not silently
 * change how your event is run.
 */
export function EventSettings() {
  const { t } = useIntl();
  const settings = useEventSettings();
  const updateSettings = useUpdateEventSettings();
  const usedChartCount = useAppState((s) => selectChartUsage(s).count);

  return (
    <Card compact className={styles.eventSettings}>
      <h2>{t("controls.eventSettings")}</h2>
      <p className={styles.eventSettingsHint}>
        {t("controls.eventSettingsHint")}
      </p>
      <Checkbox
        id="preventChartReuse"
        checked={settings.preventChartReuse}
        onChange={(e) =>
          updateSettings({ preventChartReuse: !!e.currentTarget.checked })
        }
        label={t("controls.preventChartReuse")}
      />
      {settings.preventChartReuse && (
        <Callout compact intent="primary" icon={null}>
          {t("controls.chartsUsedSoFar", { count: usedChartCount })}
        </Callout>
      )}
      <Checkbox
        id="hideVetos"
        checked={settings.hideVetos}
        onChange={(e) =>
          updateSettings({ hideVetos: !!e.currentTarget.checked })
        }
        label={t("controls.hideVetos")}
      />
      <Checkbox
        id="showMaxScore"
        checked={settings.showMaxScore}
        onChange={(e) =>
          updateSettings({ showMaxScore: !!e.currentTarget.checked })
        }
        label={t("controls.showMaxScore")}
      />
      <Checkbox
        id="showPlayerAndRoundLabels"
        checked={settings.showPlayerAndRoundLabels}
        onChange={(e) =>
          updateSettings({
            showPlayerAndRoundLabels: !!e.currentTarget.checked,
          })
        }
        label={t("controls.playerLabels")}
      />
    </Card>
  );
}
