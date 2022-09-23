import { MenuItem } from "@blueprintjs/core";
import { Suggest2 } from "@blueprintjs/select";

import { filterRoundLabel, renderRoundLabel, roundLabels } from "./round-label";
import { useDrawing } from "../drawing-context";

const RoundLabel = Suggest2.ofType<string>();

function identity<T>(input: T): T {
  return input;
}

export function RoundSelect() {
  const updateDrawing = useDrawing((d) => d.updateDrawing);
  const tournamentTitle = useDrawing((d) => d.title);

  return (
    <RoundLabel
      inputProps={{
        large: true,
        style: {
          boxShadow: "none",
          textAlign: "center",
          width: "300px",
        },
        placeholder: "Round Title",
      }}
      items={roundLabels}
      createNewItemPosition="first"
      createNewItemFromQuery={identity}
      inputValueRenderer={identity}
      createNewItemRenderer={(query, active, handleClick) => (
        <MenuItem
          active={active}
          key={query}
          onClick={handleClick}
          text={query}
          icon="new-text-box"
          roleStructure="listoption"
        />
      )}
      itemPredicate={filterRoundLabel}
      itemRenderer={renderRoundLabel}
      noResults={
        <MenuItem
          disabled={true}
          text="No results."
          roleStructure="listoption"
        />
      }
      onItemSelect={(title) => updateDrawing({ title })}
      selectedItem={tournamentTitle || null}
    />
  );
}
