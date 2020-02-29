import { Song, Chart } from "./models/SongData";
import { ChartList } from "./chart-list";
import styles from "./song-list.css";

interface Props {
  songs: Song[];
  onSelect: (song: Song, chart: Chart) => void;
  filter?: boolean;
}

export function SongList(props: Props) {
  return (
    <>
      {props.songs.map(song => (
        <div className={styles.suggestion}>
          <img src={`/jackets/${song.jacket}`} className={styles.img} />
          <div className={styles.title}>
            {song.name_translation || song.name}
            <br />
            {song.artist_translation || song.artist}
          </div>
          <ChartList
            song={song}
            filter={props.filter}
            onClickChart={props.onSelect.bind(undefined, song)}
          />
        </div>
      ))}
    </>
  );
}
