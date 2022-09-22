import React, { useState } from "react";
import { Button, MenuItem } from "@blueprintjs/core";
import { Select2 } from "@blueprintjs/select";

import { filterRoundLabel, renderRoundLabel, IRoundLabel, roundLabels } from "./round-label";

const RoundLabel = Select2.ofType<IRoundLabel>();

export const RoundSelect: React.FC = () => {
  const [roundLabel, setRoundLabel] = useState<IRoundLabel>(roundLabels[0]);
  const roundLabelStyle = {
    backgroundColor: "transparent",
    padding: "10px",
  };
  return (
      <RoundLabel
        items={roundLabels}
        itemPredicate={filterRoundLabel}
        itemRenderer={renderRoundLabel}
        noResults={<MenuItem disabled={true} text="No results." />}
        onItemSelect={setRoundLabel}
        className="round-select"
      >
        <Button text={roundLabel.title} style={roundLabelStyle} rightIcon="caret-down" />
      </RoundLabel>
  );
};
