import { useIntl } from "../hooks/useIntl";
import { toaster } from "../toaster";

export function showDrawErrorToast() {
  toaster.show(
    {
      message: <DrawErrorMessage />,
      intent: "danger",
      icon: "error",
    },
    "fail-draw",
  );
}

function DrawErrorMessage() {
  const { t } = useIntl();
  return t("controls.invalid");
}
