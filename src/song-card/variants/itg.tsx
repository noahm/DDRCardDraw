import { BaseCardFooter, CardSectionProps, baseChartValues } from "./base";

export function ItgCardFooter(props: CardSectionProps) {
  const { flags } = baseChartValues(props.chart);
  return (
    <BaseCardFooter
      chart={props.chart}
      centerElement={flags?.includes("noCmod") && "🚫"}
    />
  );
}
