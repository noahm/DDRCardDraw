import {
  Combobox,
  Group,
  Input,
  InputBase,
  ScrollArea,
  useCombobox,
} from "@mantine/core";
import { IconFileImport, IconFolder } from "@tabler/icons-react";
import { useDataSets } from "./hooks/useDataSets";
import { groupGameData, CUSTOM_DATA_PARENT } from "./utils";
import { useIntl } from "./hooks/useIntl";
import { useState } from "react";
import { useSetAtom } from "jotai";
import {
  customDataDialogOpen,
  useSetLastGameSelected,
} from "./state/game-data.atoms";

/**
 * Selecting this doesn't pick game data — it opens the custom-data dialog. It's
 * still an Option so it stays in the arrow-key flow, but it lives in the footer
 * and is intercepted in onOptionSubmit rather than ever becoming a value.
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
  const [search, setSearch] = useState("");
  const currentValue = props.value || innerValue;
  const currentDisplay = available.find(
    (d) => d.name === currentValue,
  )?.display;

  const combobox = useCombobox({
    onDropdownClose: () => {
      combobox.resetSelectedOption();
      setSearch("");
    },
    onDropdownOpen: () => combobox.focusSearchInput(),
  });

  const matches = (label: string) =>
    label.toLowerCase().includes(search.trim().toLowerCase());

  // groups render in catalog order; the custom-data folder is folded in with the
  // rest rather than pinned, since its contents are ordinary selectable games
  const groups = groupGameData(available).flatMap((item) => {
    if (item.type === "game") {
      return matches(item.display)
        ? [
            <Combobox.Option value={item.name} key={item.name}>
              {item.display}
            </Combobox.Option>,
          ]
        : [];
    }
    const label =
      item.name === CUSTOM_DATA_PARENT
        ? t("gameMenu.parent.custom")
        : t("gameMenu.parent." + item.name);
    const options = item.games
      .filter((g) => matches(g.display))
      .map((g) => (
        <Combobox.Option value={g.name} key={g.name}>
          {g.display}
        </Combobox.Option>
      ));
    if (!options.length) {
      return [];
    }
    return [
      <Combobox.Group
        key={item.name}
        label={
          <Group gap={6} wrap="nowrap">
            <IconFolder size={14} />
            {label}
          </Group>
        }
      >
        {options}
      </Combobox.Group>,
    ];
  });

  return (
    <>
      {props.name ? (
        <input type="hidden" value={currentValue} name={props.name} />
      ) : null}
      <Combobox
        store={combobox}
        withinPortal
        onOptionSubmit={(name) => {
          if (name === CREATE_CUSTOM_DATA) {
            combobox.closeDropdown();
            openCustomDataDialog(true);
            return;
          }
          props.onGameSelect?.(name);
          setLastGameSelected(name);
          setInnerValue(name);
          combobox.closeDropdown();
        }}
      >
        <Combobox.Target>
          <InputBase
            component="button"
            type="button"
            pointer
            style={props.fill ? undefined : { display: "inline-block" }}
            rightSection={<Combobox.Chevron />}
            rightSectionPointerEvents="none"
            onClick={() => combobox.toggleDropdown()}
          >
            {currentDisplay || (
              <Input.Placeholder>Select a game</Input.Placeholder>
            )}
          </InputBase>
        </Combobox.Target>

        <Combobox.Dropdown>
          <Combobox.Search
            value={search}
            onChange={(e) => setSearch(e.currentTarget.value)}
            placeholder={t("gameMenu.title")}
          />
          <Combobox.Options>
            <ScrollArea.Autosize mah={280} type="scroll">
              {groups.length ? (
                groups
              ) : (
                <Combobox.Empty>No matching game data</Combobox.Empty>
              )}
            </ScrollArea.Autosize>
          </Combobox.Options>
          {/* a real action, not an option: stays pinned and visible instead of
              scrolling away at the bottom of ~40 games */}
          <Combobox.Footer>
            <Combobox.Option value={CREATE_CUSTOM_DATA}>
              <Group gap={6} wrap="nowrap">
                <IconFileImport size={14} />
                {t("createCustomData")}
              </Group>
            </Combobox.Option>
          </Combobox.Footer>
        </Combobox.Dropdown>
      </Combobox>
    </>
  );
}
