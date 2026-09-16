import { AnchorButton, Card } from "@blueprintjs/core";
import { Duplicate } from "@blueprintjs/icons";
import classNames from "classnames";
import { ReactNode } from "react";
import { copyObsSource } from "./copy-obs-source";

import styles from "./obs-source-row.css";

/**
 * One OBS source on the dashboard: what it is, the URL to paste into a browser
 * source, and a button to copy it.
 *
 * Takes an already-resolved `href` rather than building one, because the
 * sources listed on this page don't share a shape — some hang off a cab, some
 * off the event — and the row has no business knowing which it is showing.
 */
export function SourceRow({
  href,
  label,
  above,
}: {
  /** app-relative path to the source, as `useHref` resolves it */
  href: string;
  label: ReactNode;
  /** controls to show over the url, for a source that's configurable */
  above?: ReactNode;
}) {
  const fullUrl = new URL(href, document.location.href).href;
  return (
    <Card
      className={classNames(styles.sourceCard, {
        [styles.hasControls]: !!above,
      })}
    >
      <span className={styles.sourceLabel}>{label}</span>
      <span className={styles.sourceDetail}>
        {above && <span className={styles.sourceControls}>{above}</span>}
        <code className={styles.sourceUrl} title={fullUrl}>
          {fullUrl}
        </code>
      </span>
      <AnchorButton
        icon={<Duplicate />}
        title="Copy source URL"
        onClick={(e) => {
          e.preventDefault();
          copyObsSource(fullUrl);
        }}
        href={href}
      />
    </Card>
  );
}
