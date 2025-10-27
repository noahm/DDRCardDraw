export type { CardSectionProps, CardContentsProps } from "./base";
export { baseChartValues } from "./base";

import { BaseCardCenter, type CardContentsProps, BaseCardFooter } from "./base";
import { DdrCardFooter } from "./ddr";
import { ItgCardFooter } from "./itg";

export function getContentVariants(
  cardType: string | undefined,
): CardContentsProps {
  switch (cardType) {
    case "ddr":
      return {
        CenterContent: BaseCardCenter,
        FooterContent: DdrCardFooter,
      };
    case "itg":
      return {
        CenterContent: BaseCardCenter,
        FooterContent: ItgCardFooter,
      };
    default:
      return {
        CenterContent: BaseCardCenter,
        FooterContent: BaseCardFooter,
      };
  }
}
