import { Select } from "@mantine/core";
import { useDataSets } from "./hooks/useDataSets";
import { groupGameData, CUSTOM_DATA_PARENT } from "./utils";
import { useIntl } from "./hooks/useIntl";
import { useState } from "react";
import { useSetAtom } from "jotai";
import {
  customDataDialogOpen,
  useSetLastGameSelected,
} from "./state/game-data.atoms";

type Option = { value: string; label: string };
type Group = { group: string; items: Option[] };

/**
 * Select has no notion of an action row, so the "create custom data" entry is a
 * normal option carrying this sentinel value and is intercepted in onChange.
 */
const CREATE_CUSTOM_DATA = "__create-custom-data__";

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
  const openCustomDataDialog = useSetAtom(customDataDialogOpen);
  const { available } = useDataSets();
  const [innerValue, setInnerValue] = useState(props.defaultValue);
  const currentValue = props.value || innerValue;

  const grouped = groupGameData(available);
  const customGroup = grouped.find(
    (item) => item.type === "parent" && item.name === CUSTOM_DATA_PARENT,
  );
  const customGames = customGroup?.type === "parent" ? customGroup.games : [];

  const data: Array<Option | Group> = grouped.flatMap<Option | Group>(
    (item) => {
      if (item.type === "game") {
        return { value: item.name, label: item.display };
      }
      // the custom-data folder is always appended below, even when empty
      if (item.name === CUSTOM_DATA_PARENT) {
        return [];
      }
      return {
        group: t("gameMenu.parent." + item.name),
        items: item.games.map((g) => ({ value: g.name, label: g.display })),
      };
    },
  );
  data.push({
    group: t("gameMenu.parent.custom"),
    items: [
      ...customGames.map((g) => ({ value: g.name, label: g.display })),
      { value: CREATE_CUSTOM_DATA, label: t("createCustomData") },
    ],
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
          if (name === CREATE_CUSTOM_DATA) {
            openCustomDataDialog(true);
            return;
          }
          props.onGameSelect?.(name);
          setLastGameSelected(name);
          setInnerValue(name);
        }}
      />
    </>
  );
}
