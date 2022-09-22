import { MenuItem } from "@blueprintjs/core";
import { ItemPredicate, ItemRenderer } from "@blueprintjs/select";
import React from "react";

export interface IRoundLabel {
  title: string;
  rank: number;
}

export const roundLabels: IRoundLabel[] = [
  { title: "Winner's Bracket"},
  { title: "Winner's Round"},
  { title: "Winner's Round 1"},
  { title: "Winner's Round 2"},
  { title: "Winner's Round 3"},
  { title: "Winner's Round 4"},
  { title: "Winner's Round 5"},
  { title: "Winner's Quarterfinals"},
  { title: "Winner's Semifinals"},
  { title: "Winner's Finals"},
  { title: "Loser's Bracket"},
  { title: "Loser's Round"},
  { title: "Loser's Round 1"},
  { title: "Loser's Round 2"},
  { title: "Loser's Round 3"},
  { title: "Loser's Round 4"},
  { title: "Loser's Round 5"},
  { title: "Loser's Quarterfinals"},
  { title: "Loser's Semifinals"},
  { title: "Loser's Finals"},
  { title: "Casuals"},
  { title: "Warmup"},
  { title: "Freeplay"},
].map((m, index) => ({ ...m, rank: index + 1 }));

export const renderRoundLabel: ItemRenderer<IRoundLabel> = (
  roundLabel,
  { handleClick, modifiers, query }
) => {
  if (!modifiers.matchesPredicate) {
    return null;
  }
  const text = `${roundLabel.title}`;
  return (
    <MenuItem
      active={modifiers.active}
      disabled={modifiers.disabled}
      key={roundLabel.rank}
      onClick={handleClick}
      text={highlightText(text, query)}
    />
  );
};

export const filterRoundLabel: ItemPredicate<IRoundLabel> = (query, roundLabel) => {
  return (
    `${roundLabel.title.toLowerCase()}`.indexOf(
      query.toLowerCase()
    ) >= 0
  );
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
  items: roundLabels
};
