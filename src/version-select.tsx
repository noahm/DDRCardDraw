import { Select } from "@mantine/core";
import { useDataSets } from "./hooks/useDataSets";
import { groupGameData } from "./utils";
import { useIntl } from "./hooks/useIntl";
import { useState } from "react";
import { useSetLastGameSelected } from "./state/game-data.atoms";

export function GameDataSelect(props: {
  /** if provided, a hidden input will be rendered with current value */
  name?: string;
  value?: string;
  defaultValue?: string;
  onGameSelect?(gameKey: string): void;
  fill?: boolean;
}) {
  const { t } = useIntl();
  const setLastGameSelected = useSetLastGameSelected();
  const { available } = useDataSets();
  const [innerValue, setInnerValue] = useState(props.defaultValue);
  const currentValue = props.value || innerValue;

  const data = groupGameData(available).map<
    | { value: string; label: string }
    | { group: string; items: { value: string; label: string }[] }
  >((item) => {
    if (item.type === "game") {
      return { value: item.name, label: item.display };
    }
    return {
      group: t("gameMenu.parent." + item.name),
      items: item.games.map((g) => ({ value: g.name, label: g.display })),
    };
  });

  return (
    <>
      {props.name ? (
        <input type="hidden" value={currentValue} name={props.name} />
      ) : null}
      <Select
        style={props.fill ? undefined : { display: "inline-block" }}
        placeholder="Select a game"
        searchable={false}
        allowDeselect={false}
        comboboxProps={{ withinPortal: true }}
        data={data}
        value={currentValue || null}
        onChange={(name) => {
          if (!name) return;
          props.onGameSelect?.(name);
          setLastGameSelected(name);
          setInnerValue(name);
        }}
      />
    </>
  );
}
