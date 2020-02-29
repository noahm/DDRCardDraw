import { useContext, useState } from "preact/hooks";
import { DrawStateContext } from "./draw-state";
import { Song } from "./models/SongData";
import { ChartList } from "./chart-list";
import { SongSearch } from "./song-search";
import { useLocation } from "wouter-preact";

export function SongsPage() {
  const [_, setLocation] = useLocation();
  const { gameData, dataSetName } = useContext(DrawStateContext);
  const [song, setSelectedSong] = useState<Song | undefined>(undefined);
  if (!gameData) {
    return <div>No game data loaded yet</div>;
  }

  if (song) {
    return (
      <div>
        <h1>{song.name}</h1>
        <h2>{song.artist}</h2>
        <h3>Charts</h3>
        <ChartList song={song} />
      </div>
    );
  }

  return (
    <SongSearch
      onSongSelect={setSelectedSong}
      onCancel={() => setLocation(`/${dataSetName}`)}
    />
  );
}
