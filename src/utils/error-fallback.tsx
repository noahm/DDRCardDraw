import { FormattedMessage } from "react-intl";
import { Button, Card } from "@mantine/core";
import { IconExclamationCircle, IconRefresh } from "@tabler/icons-react";
import { useErrorBoundary } from "react-error-boundary";
import { useIsNarrow } from "../hooks/useMediaQuery";
import { useIntl } from "../hooks/useIntl";
import { EmptyState } from "../common-components/empty-state";

export function ErrorFallback({
  forceLayout,
}: {
  forceLayout?: "vertical" | "horizontal";
}) {
  const { t } = useIntl();
  const { resetBoundary } = useErrorBoundary();
  const isNarrow = useIsNarrow();
  return (
    <Card withBorder shadow="md">
      <EmptyState
        layout={forceLayout || isNarrow ? "vertical" : "horizontal"}
        icon={<IconExclamationCircle size={48} />}
        title={t("error.title")}
        description={t("error.description")}
        action={
          <Button
            variant="default"
            onClick={resetBoundary}
            leftSection={<IconRefresh size={16} />}
          >
            <FormattedMessage id="error.reset" defaultMessage="Reset" />
          </Button>
        }
      />
    </Card>
  );
}
