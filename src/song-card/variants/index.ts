export type { CardSectionProps, CardContentsProps, CardAction } from "./base";
export { baseChartValues } from "./base";

import {
  BaseCardCenter,
  BaseCardFooter,
  type CardContentsProps,
  MaxScoreCardCenter,
} from "./base";
import { DdrCardFooter } from "./ddr";
import { ItgCardFooter } from "./itg";
import { MaimaiCardFooter } from "./maimai";
import { DonkeyKongaCardCenter } from "./donkeykonga";
import { SmxCardCenter, SmxCardFooter, getSmxCardActions } from "./smx";

export function getContentVariants(
  cardType: string | undefined,
): CardContentsProps {
  switch (cardType) {
    case "ddr":
      return {
        CenterContent: MaxScoreCardCenter,
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
    case "smx":
      return {
        CenterContent: SmxCardCenter,
        FooterContent: SmxCardFooter,
        getActions: getSmxCardActions,
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
