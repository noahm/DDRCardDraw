import { IconWifiOff } from "@tabler/icons-react";
import { useIntl } from "../../hooks/useIntl";
import { BaseCardFooter, CardSectionProps, baseChartValues } from "./base";
import ddrStyles from "./ddr.css";

export function DdrCardFooter(props: CardSectionProps) {
  const { flags } = baseChartValues(props.chart);
  const { t } = useIntl();
  return (
    <BaseCardFooter
      chart={props.chart}
      centerElement={
        flags?.includes("shock") && (
          <div className={ddrStyles.shockBadge}>
            <IconWifiOff title={t("controls.shockArrows")} size={14} />
          </div>
        )
      }
    />
  );
}
