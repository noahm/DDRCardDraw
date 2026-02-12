import { copyPlainTextToClipboard } from "../utils/share";

export const routableGlobalSourcePath = (labelId: string) =>
  `../obs-globals/${labelId}`;
export const routableCabSourcePath = (cabId: string, sourceName: string) =>
  `cab/${cabId}/source/${sourceName}`;

export function copyObsSource(href: string) {
  copyPlainTextToClipboard(href, "Copied OBS source URL to clipboard");
}
