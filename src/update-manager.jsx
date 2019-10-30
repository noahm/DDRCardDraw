import * as OfflinePluginRuntime from "offline-plugin/runtime";
import { useState, useEffect } from "preact/hooks";
import styles from "./update-manager.css";
import { Text } from "preact-i18n";

export function UpdateManager() {
  const [updateStatus, setStatus] = useState(null);
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
      return (
        <p className={styles.updateBanner}>
          <Text id="updateLoading">Downloading update...</Text>
        </p>
      );
    case "ready":
      return (
        <p className={styles.updateBanner}>
          <Text id="updateReady">
            Update available, refresh for the freshest code around!
          </Text>
        </p>
      );
    default:
      return null;
  }
}
