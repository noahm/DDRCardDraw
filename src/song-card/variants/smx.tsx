import { Barcode, Edit } from "@blueprintjs/icons";
import { JSX, useMemo } from "react";
import { renderSVG } from "uqr";
import { readExtra } from "../../utils/extras";
import { copyTextToClipboard } from "../../utils/share";
import { EDIT_AUTHOR_KEY, EDIT_ID_KEY } from "../../utils/smx-edit-import";
import {
  BaseCardCenter,
  BaseCardFooter,
  CardAction,
  CardSectionProps,
  baseChartValues,
} from "./base";
import styles from "./smx.css";

/**
 * Like the base card center, but adds the edit chart's author on a line below
 * the song artist when present.
 */
export function SmxCardCenter(props: CardSectionProps) {
  const { extras, name } = baseChartValues(props.chart);
  const author = readExtra(extras, EDIT_AUTHOR_KEY);
  let boss: JSX.Element | null = null;
  if (name === "Big Boss") {
    boss = (
      <>
        <div style={{ fontSize: "300%" }}>{name}</div>
      </>
    );
  }
  return (
    <>
      {boss || <BaseCardCenter chart={props.chart} />}
      {author && (
        <div className={styles.editAuthor}>
          <Edit size={20} />
          {author}
        </div>
      )}
    </>
  );
}

export function SmxCardFooter(props: CardSectionProps) {
  const editId = readExtra(baseChartValues(props.chart).extras, EDIT_ID_KEY);
  return (
    <BaseCardFooter
      chart={props.chart}
      centerElement={editId && <div>{editId}</div>}
    />
  );
}

/**
 * For edit charts, offer a QR code linking to the edit's share page so players
 * can open and bookmark it in-game.
 */
export function getSmxCardActions(
  chart: CardSectionProps["chart"],
): CardAction[] {
  const editId = readExtra(baseChartValues(chart).extras, EDIT_ID_KEY);
  if (!editId) {
    return [];
  }
  return [
    {
      key: "edit-qr",
      labelKey: "meta.bookmarkEdit",
      labelDefault: "QR code bookmark link",
      icon: <Barcode />,
      content: <EditQrContent editId={editId} />,
    },
  ];
}

/** Base url that an edit share code resolves to in-game. */
const EDIT_BASE_URL = "https://edits.stepmaniax.com/";

/**
 * Popover body showing a QR code for an edit's share link, anchored to the
 * card it came from so it's clear which chart is being shared.
 */
function EditQrContent({ editId }: { editId: string }) {
  const url = EDIT_BASE_URL + editId;
  const svg = useMemo(() => renderSVG(url), [url]);

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
