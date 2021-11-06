import * as OfflinePluginRuntime from "offline-plugin/runtime";
import { useState, useEffect } from "react";
import { useIntl } from "./hooks/useIntl";
import styles from "./update-manager.css";

export function UpdateManager() {
  const { t } = useIntl();
  const [updateStatus, setStatus] = useState<null | "loading" | "ready">(null);
  useEffect(() => {
    if (process.env.NODE_ENV === "production") {
      OfflinePluginRuntime.install({
        onUpdateReady() {
          OfflinePluginRuntime.applyUpdate();
          setStatus("loading");
        },
        onUpdated: () => {
          setStatus("ready");
        },
      });
    }
  }, []);

  switch (updateStatus) {
    case "loading":
      return <p className={styles.updateBanner}>{t("updateLoading")}</p>;
    case "ready":
      return <p className={styles.updateBanner}>{t("updateReady")}</p>;
    default:
      return null;
  }
}
