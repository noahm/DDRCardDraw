import { Checkbox } from "@blueprintjs/core";
import { Desktop } from "@blueprintjs/icons";
import { useIntl } from "../hooks/useIntl";
import {
  useLocalSettings,
  useUpdateLocalSettings,
} from "../state/local-settings.atoms";
import styles from "./controls.css";

/**
 * The settings this browser answers for itself, sitting under the event's in
 * the same pane so there's one place to look — but fenced off with a rule, an
 * icon and a heading that says so, because the difference that matters here is
 * who a change reaches. Everything above it the whole room sees; nothing below
 * it leaves this browser.
 *
 * `src/state/local-settings.atoms.ts` holds the settings themselves, and is
 * where another one goes.
 */
export function LocalSettings() {
  const { t } = useIntl();
  const settings = useLocalSettings();
  const updateSettings = useUpdateLocalSettings();

  return (
    <div className={styles.localSettings}>
      <h2>
        <Desktop className={styles.localSettingsIcon} />
        {t("controls.localSettings")}
      </h2>
      <p className={styles.eventSettingsHint}>
        {t("controls.localSettingsHint")}
      </p>
      <Checkbox
        id="hideVetos"
        checked={settings.hideVetos}
        onChange={(e) =>
          updateSettings({ hideVetos: !!e.currentTarget.checked })
        }
        label={t("controls.hideVetos")}
      />
    </div>
  );
}
