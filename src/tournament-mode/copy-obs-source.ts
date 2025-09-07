import { copyPlainTextToClipboard } from "../utils/share";

export function copyObsGlobal(labelId: string) {
  // using .. because we assume this is only called on `/e/:event/dash` for now...
  const sourcePath = `${window.location.pathname}/../obs-globals/${labelId}`;
  const sourceUrl = new URL(sourcePath, window.location.href);
  console.info("Coyping source URL", sourceUrl.href);
  copyPlainTextToClipboard(
    sourceUrl.href,
    "Copied OBS source URL to clipboard",
  );
}

export function copyObsSourceForCab(cabId: string, sourceType: string) {
  const sourcePath = `${window.location.pathname}/cab/${cabId}/source/${sourceType}`;
  const sourceUrl = new URL(sourcePath, window.location.href);
  console.info("Coyping source URL", sourceUrl.href);
  copyPlainTextToClipboard(
    sourceUrl.href,
    "Copied OBS source URL to clipboard",
  );
}
