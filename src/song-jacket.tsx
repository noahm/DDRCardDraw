import { Song } from "./models/SongData";
import { Icon } from "@blueprintjs/core";
import { Music } from "@blueprintjs/icons";
import { getJacketUrl } from "./utils/jackets";

interface Props {
  song: Song;
  className?: string;
  height: number;
}

export function SongJacket(props: Props) {
  if (props.song.jacket) {
    return (
      <img
        src={getJacketUrl(props.song.jacket)}
        className={props.className}
        style={{ height: `${props.height}px` }}
      />
    );
  }
  return (
    <div className={props.className}>
      <Icon icon={<Music />} size={props.height} />
    </div>
  );
}
