import { copyPlainTextToClipboard } from "../utils/share";

export const routableGlobalSourcePath = (labelId: string) =>
  `../obs-globals/${labelId}`;

export const routableCabSourcePath = (cabId: string, sourceName: string) =>
  `cab/${cabId}/source/${sourceName}`;

/** layouts the drawn-charts source can be asked for, in the order they're offered */
export const drawnChartsLayouts = ["grid", "list"] as const;

export type DrawnChartsLayout = (typeof drawnChartsLayouts)[number];

export const routableDrawnChartsSourcePath = (layout: DrawnChartsLayout) =>
  `../source/drawn-charts/${layout}`;

export function copyObsSource(href: string) {
  void copyPlainTextToClipboard(href, "Copied OBS source URL to clipboard");
}
