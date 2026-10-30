// import { Classes, Text } from "@blueprintjs/core";
// import cn from "classnames";
// import { FormattedMessage } from "react-intl";
// import { detectedLanguage } from "./utils";
// import { useAppState } from "./state/store";
// import { useStockGameData } from "./state/game-data.atoms";

export function LastUpdate() {
  return null; // for now it doesn't make sense because a config can't be selected globally
  // const dataSetName = useAppState((s) => s.config.current);
  // if (!dataSetName) {
  //   return null;
  // }
  // return <LastUpdateForGame game={dataSetName} />;
}

// function LastUpdateForGame(props: { game: string }) {
//   const gameData = useStockGameData(props.game);
//   if (!gameData) {
//     return null;
//   }
//   const lastUpdate = new Date(gameData.meta.lastUpdated);
//   return (
//     <Text
//       className={cn(Classes.TEXT_MUTED, Classes.TEXT_SMALL)}
//       style={{ padding: "10px", margin: 0 }}
//     >
//       <FormattedMessage
//         id="lastUpdate"
//         values={{
//           gameName: props.game,
//           date: new Intl.DateTimeFormat(detectedLanguage).format(lastUpdate),
//         }}
//       />
//     </Text>
//   );
// }
