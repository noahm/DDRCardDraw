export type { CardSectionProps, CardContentsProps } from "./base";
export { baseChartValues } from "./base";

import { BaseCardCenter, type CardContentsProps, BaseCardFooter } from "./base";
import { DdrCardFooter } from "./ddr";
import { ItgCardFooter } from "./itg";
import { MaimaiCardFooter } from "./maimai";
import { DonkeyKongaCardCenter } from "./donkeykonga";

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
    case "maimai":
      return {
        CenterContent: BaseCardCenter,
        FooterContent: MaimaiCardFooter,
      };
    case "donkeykonga":
      return {
        CenterContent: DonkeyKongaCardCenter,
        FooterContent: BaseCardFooter,
      };
    default:
      return {
        CenterContent: BaseCardCenter,
        FooterContent: BaseCardFooter,
      };
  }
}
