import {
  Button,
  Menu,
  MenuItem,
  Spinner,
  SpinnerSize,
} from "@blueprintjs/core";
import { Select } from "@blueprintjs/select";
import { ReactNode, useEffect, useState } from "react";
import { useDrawState } from "./draw-state";
import { useDataSets } from "./hooks/useDataSets";
import { groupGameData } from "./utils";
import { useIntl } from "./hooks/useIntl";

export function VersionSelect() {
  const { t } = useIntl();
  const { current, available, loadData } = useDataSets();
  return (
    <Select
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
                    icon="folder-open"
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
        }
      ) =>
        matchesPredicate ? null : (
          <MenuItem
            role="listitem"
            // icon="document"
            key={item.name}
            text={item.display}
            {...{ onClick, onFocus, active, disabled }}
            selected={current.name === item.name}
          />
        )
      }
      onItemSelect={(item) => loadData(item.name)}
    >
      <Button text={current.display} rightIcon="double-caret-vertical" />
    </Select>
  );
}

export function DataLoadingSpinner() {
  const dataIsLoading = useDrawState((s) => !s.gameData);
  if (!dataIsLoading) {
    return null;
  }
  return (
    <DelayRender>
      <Spinner size={SpinnerSize.SMALL} /> Loading game...
    </DelayRender>
  );
}

interface DelayProps {
  children: ReactNode;
}

function DelayRender(props: DelayProps) {
  const [display, setDisplay] = useState(false);
  useEffect(() => {
    const handle = setTimeout(() => {
      setDisplay(true);
    }, 200);
    return () => clearTimeout(handle);
  }, []);
  if (display) {
    return <>{props.children}</>;
  }
  return null;
}
