import { MenuItem } from "@blueprintjs/core";
import { ItemPredicate, ItemRenderer } from "@blueprintjs/select";
import { ReactNode } from "react";
import FuzzySearch from "fuzzy-search";
import { BlueprintIcons_16Id } from "@blueprintjs/icons/lib/esm/generated/16px/blueprint-icons-16";

export const renderRoundLabel: ItemRenderer<string> = (
  roundLabel,
  { handleClick, modifiers, query, handleFocus },
) => {
  if (!modifiers.matchesPredicate) {
    return null;
  }
  let icon: BlueprintIcons_16Id | null = null;
  let text = roundLabel;
  if (roundLabel === "") {
    icon = "delete";
    text = "No label";
  }
  return (
    <MenuItem
      icon={icon}
      active={modifiers.active}
      disabled={modifiers.disabled}
      style={{ opacity: roundLabel ? undefined : 0.5 }}
      key={roundLabel}
      onClick={handleClick}
      onFocus={handleFocus}
      text={highlightText(text, query)}
      roleStructure="listoption"
    />
  );
};

export const filterRoundLabel: ItemPredicate<string> = (query, roundLabel) => {
  if (!query) {
    return true;
  }
  return !!FuzzySearch.isMatch(roundLabel, query, false);
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
  const tokens: ReactNode[] = [];
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
  return text.replace(/([.*+?^=!:${}()|[\]/\\])/g, "\\$1");
}
