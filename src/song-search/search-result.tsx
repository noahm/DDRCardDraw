import { JSX } from "react";
import { Edit } from "@blueprintjs/icons";
import { AbbrDifficulty } from "../game-data-utils";
import { useIntl } from "../hooks/useIntl";
import { Song, Chart } from "../models/SongData";
import { SongJacket } from "../song-jacket";
import { readExtra } from "../utils/extras";
import { EDIT_AUTHOR_KEY } from "../utils/smx-edit-import";
import styles from "./song-search.css";
import { MenuItem } from "@blueprintjs/core";

export interface SearchResultData {
  song: Song;
  chart: Chart | "none";
}

interface ResultsProps {
  data: SearchResultData;
  selected: boolean;
  handleClick: React.MouseEventHandler<HTMLElement>;
}

export function SearchResult({ data, selected, handleClick }: ResultsProps) {
  const song = data.song;
  const { t } = useIntl();
  let label: string | JSX.Element;
  let disabled = false;
  let editAuthor: string | undefined;
  if (typeof data.chart === "object") {
    editAuthor = readExtra(data.chart.extras, EDIT_AUTHOR_KEY);
    label = (
      <>
        <AbbrDifficulty diffClass={data.chart.diffClass} /> {data.chart.lvl}
      </>
    );
  } else if (typeof data.chart === "string") {
    label = t("noMatchingCharts");
    disabled = true;
  } else {
    label = song.artist_translation || song.artist;
  }

  const title = song.name_translation || song.name;
  const text = editAuthor ? (
    <>
      {title}
      <span className={styles.editAuthor}>
        <Edit size={12} /> {editAuthor}
      </span>
    </>
  ) : (
    title
  );

  return (
    <MenuItem
      selected={selected}
      disabled={disabled}
      icon={<SongJacket song={song} height={26} className={styles.img} />}
      text={text}
      label={label as string}
      onClick={handleClick}
    />
  );
}
