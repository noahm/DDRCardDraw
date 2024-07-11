import { Classes, Text } from "@blueprintjs/core";
import cn from "classnames";
import { FormattedMessage } from "react-intl";
import { detectedLanguage } from "./utils";
import { useAppState } from "./state/store";
import { useAtomValue } from "jotai";
import { gameDataAtom } from "./state/game-data.atoms";

export function LastUpdate() {
  const dataSetName = useAppState((s) => s.gameData.dataSetName);
  const gameData = useAtomValue(gameDataAtom);
  if (!gameData) {
    return null;
  }
  const lastUpdate = new Date(gameData.meta.lastUpdated);
  return (
    <Text
      className={cn(Classes.TEXT_MUTED, Classes.TEXT_SMALL)}
      style={{ padding: "10px", margin: 0 }}
    >
      <FormattedMessage
        id="lastUpdate"
        values={{
          gameName: dataSetName,
          date: new Intl.DateTimeFormat(detectedLanguage).format(lastUpdate),
        }}
      />
    </Text>
  );
}
