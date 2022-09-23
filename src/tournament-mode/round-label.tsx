import { MenuItem } from "@blueprintjs/core";
import { ItemPredicate, ItemRenderer } from "@blueprintjs/select";
import React from "react";

export const roundLabels = [
  "Winner's Bracket",
  "Winner's Round",
  "Winner's Round 1",
  "Winner's Round 2",
  "Winner's Round 3",
  "Winner's Round 4",
  "Winner's Round 5",
  "Winner's Quarterfinals",
  "Winner's Semifinals",
  "Winner's Finals",
  "Loser's Bracket",
  "Loser's Round",
  "Loser's Round 1",
  "Loser's Round 2",
  "Loser's Round 3",
  "Loser's Round 4",
  "Loser's Round 5",
  "Loser's Quarterfinals",
  "Loser's Semifinals",
  "Loser's Finals",
  "Casuals",
  "Warmup",
  "Freeplay",
];

export const renderRoundLabel: ItemRenderer<string> = (
  roundLabel,
  { handleClick, modifiers, query }
) => {
  if (!modifiers.matchesPredicate) {
    return null;
  }
  return (
    <MenuItem
      active={modifiers.active}
      disabled={modifiers.disabled}
      key={roundLabel}
      onClick={handleClick}
      text={highlightText(roundLabel, query)}
      roleStructure="listoption"
    />
  );
};

export const filterRoundLabel: ItemPredicate<string> = (query, roundLabel) => {
  return `${roundLabel.toLowerCase()}`.indexOf(query.toLowerCase()) >= 0;
};

function highlightText(text: string, query: string) {
  let lastIndex = 0;
  const words = query
    .split(/\s+/)
    .filter((word) => word.length > 0)
    .map(escapeRegExpChars);
  if (words.length === 0) {
    return [text];
  }
  const regexp = new RegExp(words.join("|"), "gi");
  const tokens: React.ReactNode[] = [];
  while (true) {
    const match = regexp.exec(text);
    if (!match) {
      break;
    }
    const length = match[0].length;
    const before = text.slice(lastIndex, regexp.lastIndex - length);
    if (before.length > 0) {
      tokens.push(before);
    }
    lastIndex = regexp.lastIndex;
    tokens.push(<strong key={lastIndex}>{match[0]}</strong>);
  }
  const rest = text.slice(lastIndex);
  if (rest.length > 0) {
    tokens.push(rest);
  }
  return tokens;
}

function escapeRegExpChars(text: string) {
  return text.replace(/([.*+?^=!:${}()|\[\]\/\\])/g, "\\$1");
}

export const roundLabelProps = {
  itemPredicate: filterRoundLabel,
  itemRenderer: renderRoundLabel,
  items: roundLabels,
};
