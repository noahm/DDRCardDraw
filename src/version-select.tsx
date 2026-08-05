import { Button, Menu, MenuItem } from "@blueprintjs/core";
import { Select } from "@blueprintjs/select";
import { useDataSets } from "./hooks/useDataSets";
import { groupGameData } from "./utils";
import { useIntl } from "./hooks/useIntl";
import { DoubleCaretVertical, FolderOpen } from "@blueprintjs/icons";
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
  const currentDisplay = available.find(
    (d) => d.name === (props.value || innerValue),
  )?.display;

  return (
    <>
      {props.name ? (
        <input
          type="hidden"
          value={props.value || innerValue}
          name={props.name}
        />
      ) : null}
      <Select
        fill={props.fill}
        items={available}
        filterable={false}
        itemListRenderer={(listProps) => {
          const groupedItems = groupGameData(listProps.filteredItems);
          return (
            <Menu role="listbox" ulRef={listProps.itemsParentRef}>
              <MenuItem disabled text={t("gameMenu.title")} />
              {groupedItems.map((item) => {
                if (item.type === "game") {
                  return listProps.renderItem(item, item.index);
                } else {
                  return (
                    <MenuItem
                      key={item.name}
                      icon={<FolderOpen />}
                      text={t("gameMenu.parent." + item.name)}
                    >
                      {item.games.map((g) => listProps.renderItem(g, g.index))}
                    </MenuItem>
                  );
                }
              })}
            </Menu>
          );
        }}
        itemRenderer={(
          item,
          {
            handleClick: onClick,
            handleFocus: onFocus,
            modifiers: { active, disabled, matchesPredicate },
          },
        ) =>
          matchesPredicate ? null : (
            <MenuItem
              role="listitem"
              // icon="document"
              key={item.name}
              text={item.display}
              {...{ onClick, onFocus, active, disabled }}
              selected={(props.value || innerValue) === item.name}
            />
          )
        }
        onItemSelect={(item) => {
          props.onGameSelect?.(item.name);
          setLastGameSelected(item.name);
          setInnerValue(item.name);
        }}
      >
        <Button
          fill={props.fill}
          style={{ justifyContent: "space-between" }}
          text={currentDisplay || "Select a game"}
          endIcon={<DoubleCaretVertical />}
        />
      </Select>
    </>
  );
}

// export function DataLoadingSpinner() {
//   const loadingStatus = useAtomValue(gameDataLoadingStatus);
//   if (loadingStatus === "failed") {
//     return (
//       <>
//         <Error /> Couldn't load game!
//       </>
//     );
//   }
//   if (loadingStatus === "loading") {
//     return (
//       <DelayRender>
//         <Spinner size={SpinnerSize.SMALL} /> Loading game...
//       </DelayRender>
//     );
//   }
//   return null;
// }
