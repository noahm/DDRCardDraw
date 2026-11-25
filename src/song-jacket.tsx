import { Song } from "./models/SongData";
import { IconMusic } from "@tabler/icons-react";
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
      <IconMusic size={props.height} />
    </div>
  );
}
