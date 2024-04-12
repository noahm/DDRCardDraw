import { Card, NonIdealState, Button } from "@blueprintjs/core";
import { Error, Refresh } from "@blueprintjs/icons";
import { useErrorBoundary } from "react-error-boundary";
import { useIsNarrow } from "../hooks/useMediaQuery";

export function ErrorFallback({
  forceLayout,
}: {
  forceLayout?: "vertical" | "horizontal";
}) {
  const { resetBoundary } = useErrorBoundary();
  const isNarrow = useIsNarrow();
  return (
    <Card elevation={2}>
      <NonIdealState
        layout={forceLayout || isNarrow ? "vertical" : "horizontal"}
        icon={<Error />}
        title="Error Caught!"
        description="A deeply embarassing error just happened somewhere near here. If you're lucky, a reset will fix things up."
        action={
          <Button onClick={resetBoundary} icon={<Refresh />}>
            Reset
          </Button>
        }
      />
    </Card>
  );
}
