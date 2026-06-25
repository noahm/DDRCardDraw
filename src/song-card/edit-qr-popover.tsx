import { useMemo } from "react";
import { renderSVG } from "uqr";
import { copyTextToClipboard } from "../utils/share";
import styles from "./edit-qr-popover.css";

interface Props {
  editId: string;
}

/** Base url that an edit share code resolves to in-game. */
const EDIT_BASE_URL = "https://edits.stepmaniax.com/";

/**
 * Popover body showing a QR code for an edit's share link, anchored to the
 * card it came from so it's clear which chart is being shared.
 */
export function EditQrContent({ editId }: Props) {
  const url = EDIT_BASE_URL + editId;
  const svg = useMemo(() => renderSVG(url, { border: 2 }), [url]);

  return (
    <div className={styles.editQr}>
      <p className={styles.editQrCaption}>Scan to preview & bookmark:</p>
      <div
        className={styles.editQrCode}
        // uqr returns a self-contained, trusted SVG string
        dangerouslySetInnerHTML={{ __html: svg }}
      />
      <p className={styles.editQrLink}>
        <a
          href={url}
          target="_blank"
          rel="noreferrer"
          onClick={(e) => {
            e.preventDefault();
            void copyTextToClipboard(url, "Copied edit link");
          }}
        >
          edits.stepmaniax.com/{editId}
        </a>
      </p>
    </div>
  );
}
