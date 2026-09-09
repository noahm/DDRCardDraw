import { MenuItem } from "@blueprintjs/core";
import { ItemPredicate, ItemRenderer } from "@blueprintjs/select";
import { JSX } from "react";
import fuzzysort from "fuzzysort";
import { Delete } from "@blueprintjs/icons";

export const renderRoundLabel: ItemRenderer<string> = (
  roundLabel,
  { handleClick, modifiers, query, handleFocus },
) => {
  if (!modifiers.matchesPredicate) {
    return null;
  }
  let icon: JSX.Element | null = null;
  let text = roundLabel;
  if (roundLabel === "") {
    icon = <Delete />;
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
  return !!fuzzysort.single(query, roundLabel);
};

function highlightText(text: string, query: string) {
  const match = query ? fuzzysort.single(query, text) : null;
  if (!match) {
    return text;
  }
  return match.highlight((matched, i) => <strong key={i}>{matched}</strong>);
}
