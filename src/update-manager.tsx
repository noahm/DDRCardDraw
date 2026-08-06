import * as OfflinePluginRuntime from "@lcdp/offline-plugin/runtime";
import { useEffect } from "react";
import { Button, Stack } from "@mantine/core";
import { notify } from "./notify";
import { useIntl } from "./hooks/useIntl";
import { IconHistory } from "@tabler/icons-react";
import { useInObs } from "./theme-toggle";

/** one id for the whole update story, so it updates in place rather than
 * closing one toast and opening another */
const UPDATE_NOTIFICATION = "app-update";

export function UpdateManager() {
  const { t } = useIntl();
  const isObs = useInObs();
  useEffect(() => {
    if (process.env.NODE_ENV === "production") {
      OfflinePluginRuntime.install({
        onUpdateReady() {
          OfflinePluginRuntime.applyUpdate();
          if (isObs) return;
          notify.show({
            id: UPDATE_NOTIFICATION,
            message: t("updateLoading"),
            loading: true,
            autoClose: false,
            // nothing to act on yet, and it is replaced by the ready state
            allowClose: false,
          });
        },
        onUpdated() {
          if (isObs) {
            window.location.reload();
            return;
          }
          notify.update({
            id: UPDATE_NOTIFICATION,
            intent: "success",
            icon: <IconHistory />,
            loading: false,
            autoClose: false,
            allowClose: true,
            message: (
              <Stack gap="xs" align="flex-start">
                <span>{t("updateReady")}</span>
                <Button
                  size="compact-sm"
                  variant="white"
                  color="green"
                  onClick={() => window.location.reload()}
                >
                  {t("applyUpdate")}
                </Button>
              </Stack>
            ),
          });
        },
      });
    }
    // oxlint-disable-next-line react/exhaustive-deps
  }, []);

  return null;
}
