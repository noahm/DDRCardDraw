import cn from "classnames";
import { Song, Chart } from "./models/SongData";
import { ChartList } from "./chart-list";
import styles from "./song-list.css";

interface Props {
  songs: Song[];
  showCharts?: boolean;
  onSelect?: (song: Song) => void;
  onSelectChart?: (song: Song, chart: Chart) => void;
  filterCharts?: boolean;
}

export function SongList(props: Props) {
  return (
    <>
      {props.songs.map(song => (
        <div
          className={cn(styles.suggestion, {
            [styles.clickable]: !!props.onSelect
          })}
          onClick={props.onSelect && (() => props.onSelect!(song))}
        >
          <img src={`/jackets/${song.jacket}`} className={styles.img} />
          <div className={styles.title}>
            {song.name_translation || song.name}
            <br />
            {song.artist_translation || song.artist}
          </div>
          {props.showCharts && (
            <ChartList
              song={song}
              filter={props.filterCharts}
              onClickChart={
                props.onSelectChart && props.onSelectChart.bind(undefined, song)
              }
            />
          )}
        </div>
      ))}
    </>
  );
}
