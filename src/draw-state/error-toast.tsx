import { IconExclamationCircle } from "@tabler/icons-react";
import { useIntl } from "../hooks/useIntl";
import { notify } from "../notify";

export function showDrawErrorToast() {
  notify.show({
    id: "fail-draw",
    // rendered as a component so it picks up the current locale; the thunks
    // that trigger this have no intl context of their own
    message: <DrawErrorMessage />,
    intent: "danger",
    icon: <IconExclamationCircle />,
  });
}

function DrawErrorMessage() {
  const { t } = useIntl();
  return t("controls.invalid");
}
