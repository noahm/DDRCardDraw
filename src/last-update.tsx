import { Classes, Text } from "@blueprintjs/core";
import cn from "classnames";
import { useContext } from "react";
import { FormattedMessage } from "react-intl";
import { DrawStateContext } from "./draw-state";
import { detectedLanguage } from "./utils";

export function LastUpdate() {
  const { dataSetName, gameData } = useContext(DrawStateContext);
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
