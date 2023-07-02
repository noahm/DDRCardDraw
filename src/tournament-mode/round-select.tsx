import { Classes, MenuItem } from "@blueprintjs/core";
import { Suggest } from "@blueprintjs/select";

import { filterRoundLabel, renderRoundLabel, roundLabels } from "./round-label";
import { useDrawing } from "../drawing-context";
import { useIntl } from "../hooks/useIntl";

function identity<T>(i: T) {
  return i;
}

export function RoundSelect() {
  const { t } = useIntl();
  const updateDrawing = useDrawing((d) => d.updateDrawing);
  const tournamentTitle = useDrawing((d) => d.title);
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
  size: "medium" | "large";
  itemList: Array<string>;
  placeholder: string;
  value: string | null;
  onSelect(item: string): void;
}

export function AutoCompleteSelect(props: Props) {
  const { t } = useIntl();

  return (
    <Suggest<string>
      inputProps={{
        style: {
          boxShadow: "none",
          textAlign: "center",
          background: "transparent",
          height: "36px",
          lineHeight: "36px",
          fontSize: props.size === "medium" ? "26px" : "34px",
        },
        placeholder: props.placeholder,
        className: Classes.EDITABLE_TEXT,
      }}
      items={props.itemList}
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
      onItemSelect={(item) => {
        if (!props.itemList.includes(item)) {
          props.itemList.push(item);
        }
        props.onSelect(item);
      }}
      selectedItem={props.value || null}
    />
  );
}
