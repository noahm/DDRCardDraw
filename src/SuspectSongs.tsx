import { DrawStateContext } from "./draw-state";
import { useContext } from "preact/hooks";
import styles from "./SuspectSongs.css";

const allAscii = /^[a-zA-Z .'?&!-_0-9]+$/;
const anyAscii = /[a-zA-Z]/;

export function SuspectSongs() {
  const { gameData } = useContext(DrawStateContext);
  if (!gameData) {
    return null;
  }
  const suspectSongs = gameData.songs.filter(song => {
    if (
      !song.name.match(anyAscii) &&
      // !song.artist.match(allAscii) &&
      // !song.name_translation &&
      !song.search_hint
      // !song.artist_translation
    ) {
      return true;
    }
    return false;
  });
  return (
    <div className={styles.suspectSongs}>
      {suspectSongs.map(song => (
        <div className={styles.song}>
          <img src={`jackets/${song.jacket}`} className={styles.img} />
          <p>{song.name}</p>
          <p>{song.name_translation}</p>
        </div>
      ))}
    </div>
  );
}
