import { copyPlainTextToClipboard } from "../utils/share";

export const routableGlobalSourcePath = (labelId: string) =>
  `../obs-globals/${labelId}`;

export const routableCabSourcePath = (cabId: string, sourceName: string) =>
  `../cab/${cabId}/source/${sourceName}`;

/**
 * search param naming which cab the dashboard's source list is showing. its
 * presence also expands that section, so the whole selection is linkable
 */
export const CAB_SOURCES_PARAM = "cab";

/** links from the event's main view to one cab's sources on the dashboard */
export const routableCabDashboardPath = (cabId: string) =>
  `dash?${new URLSearchParams({ [CAB_SOURCES_PARAM]: cabId })}`;

/** layouts the drawn-charts source can be asked for, in the order they're offered */
export const drawnChartsLayouts = ["grid", "list"] as const;

export type DrawnChartsLayout = (typeof drawnChartsLayouts)[number];

export const routableDrawnChartsSourcePath = (layout: DrawnChartsLayout) =>
  `../source/drawn-charts/${layout}`;

/**
 * Takes the toast's wording rather than holding it, so the string can live in
 * the message catalog with the rest of the dashboard's. Callers are components
 * and have an intl context; this module is imported by things that don't.
 */
export function copyObsSource(href: string, copiedMessage: string) {
  void copyPlainTextToClipboard(href, copiedMessage);
}
