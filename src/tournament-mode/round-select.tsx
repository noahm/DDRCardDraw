import { Classes, MenuItem } from "@blueprintjs/core";
import { Suggest } from "@blueprintjs/select";

import { filterRoundLabel, renderRoundLabel } from "./round-label";
import { useDrawing } from "../drawing-context";
import { useIntl } from "../hooks/useIntl";
import { useMemo } from "react";
import { useConfigState } from "../config-state";

function identity<T>(i: T) {
  return i;
}

export function RoundSelect() {
  const { t } = useIntl();
  const updateDrawing = useDrawing((d) => d.updateDrawing);
  const tournamentTitle = useDrawing((d) => d.title);
  const roundLabels = useConfigState((c) => c.tournamentRounds);
  return (
    <AutoCompleteSelect
      size="medium"
      placeholder={t("tournamentRoundPlaceholder")}
      itemList={roundLabels}
      value={tournamentTitle || null}
      onSelect={(title) => updateDrawing({ title })}
    />
  );
}

interface Props {
  /** remove empty autocomplete item */
  noEmpty?: boolean;
  size: "medium" | "large";
  itemList: Array<string>;
  placeholder: string;
  value: string | null;
  onSelect(item: string): void;
}

export function AutoCompleteSelect(props: Props) {
  const { t } = useIntl();

  const items = useMemo(() => {
    const list = props.itemList.slice();
    if (!props.noEmpty) {
      list.unshift("");
    }

    return list;
  }, [props.itemList, props.noEmpty]);

  return (
    <Suggest<string>
      inputProps={{
        style: {
          boxShadow: "none",
          textAlign: "center",
          background: "transparent",
          height: "36px",
          lineHeight: "36px",
          fontSize: props.size === "medium" ? "26px" : "32px",
        },
        placeholder: props.placeholder,
      }}
      className={Classes.EDITABLE_TEXT}
      items={items}
      resetOnSelect
      resetOnClose
      createNewItemPosition="first"
      createNewItemFromQuery={identity}
      inputValueRenderer={identity}
      createNewItemRenderer={(query, active, handleClick) => (
        <MenuItem
          active={active}
          key={query}
          onClick={handleClick}
          text={t("tournamentRoundAdd", { round: query })}
          icon="add"
          roleStructure="listoption"
        />
      )}
      itemPredicate={filterRoundLabel}
      itemRenderer={renderRoundLabel}
      noResults={
        <MenuItem
          disabled={true}
          text={t("noResults")}
          roleStructure="listoption"
        />
      }
      onItemSelect={props.onSelect}
      selectedItem={props.value || null}
    />
  );
}
