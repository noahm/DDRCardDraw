import { Callout, Checkbox, FormGroup } from "@blueprintjs/core";
import { useIntl } from "../hooks/useIntl";
import { drawingSelectors, selectChartUsage } from "../state/drawings.slice";
import { useEventSettings, useUpdateEventSettings } from "../state/hooks";
import { useAppState } from "../state/store";
import { isGauntletScored } from "../models/Drawing";
import { DEFAULT_PAYOUT_SCHEME } from "../models/payout-scheme";
import { piuTourneyEnabled } from "../piu-tourney/config";
import { PayoutSchemeInput } from "./payout-scheme-input";
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
  // preview the payout against the biggest heat this room has actually drawn,
  // so an organizer sees the table their own event pays rather than an example
  const largestHeat = useAppState((s) =>
    drawingSelectors
      .selectAll(s)
      .reduce(
        (largest, drawing) =>
          isGauntletScored(drawing.meta)
            ? Math.max(largest, drawing.meta.players.length)
            : largest,
        0,
      ),
  );

  return (
    <div className={styles.eventSettings}>
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
      <FormGroup
        label={t("controls.gauntletPayout")}
        helperText={
          <>
            <div>{t("controls.gauntletPayoutHint")}</div>
            {/* a tourney maker round brings its own payout, so saying so here
                saves an organizer wondering why theirs didn't take */}
            {piuTourneyEnabled && (
              <div className={styles.settingNote}>
                {t("controls.gauntletPayoutPiuNote")}
              </div>
            )}
          </>
        }
      >
        <PayoutSchemeInput
          value={settings.gauntletPayout ?? DEFAULT_PAYOUT_SCHEME}
          // everyone in the room sees this one, so it waits to be applied
          commit="on-confirm"
          onCommit={(gauntletPayout) => updateSettings({ gauntletPayout })}
          playerCount={largestHeat > 2 ? largestHeat : undefined}
        />
      </FormGroup>
    </div>
  );
}
