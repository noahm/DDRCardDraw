import { Error } from "@blueprintjs/icons";
import { useIntl } from "../hooks/useIntl";
import { toaster } from "../toaster";

export function showDrawErrorToast() {
  toaster.show(
    {
      message: <DrawErrorMessage />,
      intent: "danger",
      icon: <Error />,
    },
    "fail-draw",
  );
}

function DrawErrorMessage() {
  const { t } = useIntl();
  return t("controls.invalid");
}
