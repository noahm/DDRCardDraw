import {
  Button,
  Menu,
  MenuItem,
  Spinner,
  SpinnerSize,
} from "@blueprintjs/core";
import { Select } from "@blueprintjs/select";
import { ReactNode, useEffect, useMemo, useState } from "react";
import { useDrawState } from "./draw-state";

import { usePackData } from "./pack-data";

export function VersionSelect() {
  const availablePacks = usePackData((d) => d.data);
  const packnames = useMemo(() => {
    const ret = availablePacks ? Object.keys(availablePacks) : [];
    ret.sort((a, b) => a.localeCompare(b));
    return ret;
  }, [availablePacks]);
  const currentPack = usePackData((d) => d.selectedPack);
  return (
    <Select
      items={packnames}
      filterable
      itemPredicate={(query, item) => {
        if (item.toLowerCase().includes(query.toLowerCase())) {
          return true;
        }
        return false;
      }}
      itemRenderer={(
        item,
        {
          handleClick: onClick,
          handleFocus: onFocus,
          modifiers: { active, disabled, matchesPredicate },
        },
      ) =>
        !matchesPredicate ? null : (
          <MenuItem
            role="listitem"
            // icon="document"
            key={item}
            text={item}
            {...{ onClick, onFocus, active, disabled }}
            selected={currentPack === item}
          />
        )
      }
      onItemSelect={(item) => usePackData.setState({ selectedPack: item })}
    >
      <Button
        text={currentPack || "Select a pack..."}
        rightIcon="double-caret-vertical"
      />
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
