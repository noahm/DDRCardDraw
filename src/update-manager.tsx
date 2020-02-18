import * as OfflinePluginRuntime from "offline-plugin/runtime";
import { useState, useEffect, useContext } from "preact/hooks";
import styles from "./update-manager.css";
import { TranslateContext } from "@denysvuika/preact-translate";

export function UpdateManager() {
  const { t } = useContext(TranslateContext);
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
        }
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
