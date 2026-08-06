import { Edit } from "@blueprintjs/icons";
import { JSX } from "react";
import { readExtra } from "../../utils/extras";
import { EDIT_AUTHOR_KEY, EDIT_ID_KEY } from "../../utils/smx-edit-import";
import {
  BaseCardCenter,
  BaseCardFooter,
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
    boss = <div style={{ fontSize: "300%" }}>{name}</div>;
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

/** Footer that surfaces the edit's share code in the center slot. */
export function SmxCardFooter(props: CardSectionProps) {
  const editId = readExtra(baseChartValues(props.chart).extras, EDIT_ID_KEY);
  return (
    <BaseCardFooter
      chart={props.chart}
      centerElement={editId && <div>{editId}</div>}
    />
  );
}
