import cn from "classnames";
import { detectedLanguage } from "./utils";
import { Classes, MenuItem, Text } from "@blueprintjs/core";
import { FormattedMessage } from "react-intl";

// note that month is zero-indexed for date constructor :)
const lastUpdate = new Date(2021, 9, 23);

export function LastUpdate() {
  return (
    <Text
      className={cn(Classes.TEXT_MUTED, Classes.TEXT_SMALL)}
      style={{ padding: "10px", margin: 0 }}
    >
      <FormattedMessage
        id="lastUpdate"
        values={{
          date: new Intl.DateTimeFormat(detectedLanguage).format(lastUpdate),
        }}
      />
    </Text>
  );
}
