import { BaseCardFooter, CardSectionProps, baseChartValues } from "./base";

export function MaimaiCardFooter(props: CardSectionProps) {
  const { extras } = baseChartValues(props.chart);
  let centerBadge = "";
  if (extras?.includes("std")) {
    centerBadge = "STD";
  } else if (extras?.includes("dx")) {
    centerBadge = "DX";
  }
  return <BaseCardFooter chart={props.chart} centerElement={centerBadge} />;
}
