import { FormattedMessage } from "react-intl";
import { Card, NonIdealState, Button } from "@blueprintjs/core";
import { Error, Refresh } from "@blueprintjs/icons";
import { useErrorBoundary } from "react-error-boundary";
import { useIsNarrow } from "../hooks/useMediaQuery";
import { useIntl } from "../hooks/useIntl";

export function ErrorFallback({
  forceLayout,
}: {
  forceLayout?: "vertical" | "horizontal";
}) {
  const { t } = useIntl();
  const { resetBoundary } = useErrorBoundary();
  const isNarrow = useIsNarrow();
  return (
    <Card elevation={2}>
      <NonIdealState
        layout={forceLayout || isNarrow ? "vertical" : "horizontal"}
        icon={<Error />}
        title={t("error.title")}
        description={t("error.description")}
        action={
          <Button onClick={resetBoundary} icon={<Refresh />}>
            <FormattedMessage id="error.reset" defaultMessage="Reset" />
          </Button>
        }
      />
    </Card>
  );
}
