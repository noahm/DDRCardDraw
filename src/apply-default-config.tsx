import { GameData } from "./models/SongData";
import { useEffect } from "react";
import { difficulties, flags, levelBounds, style } from "./config-state";
import { useRecoilTransaction_UNSTABLE } from "recoil";

interface Props {
  defaults?: GameData["defaults"];
}

export function ApplyDefaultConfig({ defaults }: Props) {
  const applyDefaults = useRecoilTransaction_UNSTABLE(
    ({ set }) =>
      (defaults: GameData["defaults"]) => {
        set(levelBounds, [defaults.lowerLvlBound, defaults.upperLvlBound] as [
          number,
          number
        ]);
        set(flags, new Set(defaults.flags));
        set(difficulties, new Set(defaults.difficulties));
        set(style, defaults.style);
      },
    []
  );
  useEffect(() => {
    if (!defaults) {
      return;
    }
    applyDefaults(defaults);
  }, [defaults]);
  return null;
}
