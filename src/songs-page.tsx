import { useContext, useState } from "preact/hooks";
import { DrawStateContext } from "./draw-state";
import { Song } from "./models/SongData";
import { ChartList } from "./chart-list";
import { SongSearch } from "./song-search";
import { useLocation } from "wouter-preact";
import { Modal } from "./modal";
import { MetaString } from "./game-data-utils";

function SongDetail({ song }: { song: Song }) {
  return (
    <div>
      <img
        src={`/jackets/${song.jacket}`}
        style={{ float: "left", width: "25em", marginRight: "1em" }}
      />
      <h1>{song.name}</h1>
      {song.name_translation && <h4>{song.name_translation}</h4>}
      <h2>{song.artist}</h2>
      {song.artist_translation && <h4>{song.artist_translation}</h4>}
      <p>BPM: {song.bpm}</p>
      <h3>Charts</h3>
      <ChartList song={song} />
      <h3>Flags</h3>
      <ul>
        {song.flags?.map(f => (
          <li key={f}>
            <MetaString field={f} />
          </li>
        )) || <li>None</li>}
      </ul>
    </div>
  );
}

export function SongsPage() {
  const [_, setLocation] = useLocation();
  const { gameData, dataSetName } = useContext(DrawStateContext);
  const [song, setSelectedSong] = useState<Song | undefined>(undefined);
  if (!gameData) {
    return <div>No game data loaded yet</div>;
  }

  if (song) {
    return (
      <Modal onClose={() => setSelectedSong(undefined)}>
        <SongDetail song={song} />
      </Modal>
    );
  }

  return (
    <Modal onClose={() => setLocation(`/${dataSetName}`)}>
      <SongSearch onSongSelect={setSelectedSong} />
    </Modal>
  );
}
