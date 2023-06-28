import { AbbrDifficulty } from "../game-data-utils";
import { useIntl } from "../hooks/useIntl";
import { Song, Chart } from "../models/SongData";
import { SongJacket } from "../song-jacket";
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
  if (typeof data.chart === "object") {
    label = (
      <>
        <AbbrDifficulty diffClass={data.chart.diffClass} /> {data.chart.lvl}
      </>
    );
  } else if (typeof data.chart === "string") {
    label = "No chart matching filters";
    disabled = true;
  } else {
    label = song.artist_translation || song.artist;
  }

  return (
    <MenuItem
      selected={selected}
      disabled={disabled}
      icon={<SongJacket song={song} height={26} className={styles.img} />}
      text={song.name_translation || song.name}
      label={label as string}
      onClick={handleClick}
    />
  );
}
