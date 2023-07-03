import { Song } from "./models/SongData";
import { Icon } from "@blueprintjs/core";
import { IconNames } from "@blueprintjs/icons";

interface Props {
  song: Song;
  className?: string;
  height: number;
}

export function SongJacket(props: Props) {
  if (props.song.jacket) {
    return (
      <img
        src={`jackets/${props.song.jacket}`}
        className={props.className}
        style={{ height: `${props.height}px` }}
      />
    );
  }
  return (
    <div className={props.className}>
      <Icon icon={IconNames.MUSIC} size={props.height} />
    </div>
  );
}
