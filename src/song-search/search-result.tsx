import { AbbrDifficulty } from "../game-data-utils";
import { useDifficultyColor } from "../hooks/useDifficultyColor";
import { useIntl } from "../hooks/useIntl";
import { ConfigState } from "../config-state";
import { Song, Chart } from "../models/SongData";
import { SongJacket } from "../song-jacket";
import styles from "./song-search.module.css";
import { MenuItem } from "@blueprintjs/core";

export interface SearchResultData {
  song: Song;
  chart?: Chart | "none";
}

interface ChartOptionProps {
  chart: Chart;
  onClick: () => void;
}

function ChartOption({ chart, onClick }: ChartOptionProps) {
  const bg = useDifficultyColor(chart.diffClass);
  return (
    <div
      className={styles.chart}
      style={{ backgroundColor: bg }}
      onClick={onClick}
    >
      <AbbrDifficulty diffClass={chart.diffClass} />
      <br />
      {chart.lvl}
    </div>
  );
}

interface ResultsProps {
  data: SearchResultData;
  selected: boolean;
  handleClick: React.MouseEventHandler<HTMLElement>;
  config: ConfigState;
}

export function SearchResult({
  data,
  selected,
  handleClick,
  config,
}: ResultsProps) {
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
