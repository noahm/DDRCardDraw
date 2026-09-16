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

export function copyObsSource(href: string) {
  void copyPlainTextToClipboard(href, "Copied OBS source URL to clipboard");
}
