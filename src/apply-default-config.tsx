import { GameData } from "./models/SongData";
import { useEffect, useContext } from "preact/hooks";
import { ConfigStateContext } from "./config-state";

interface Props {
  defaults?: GameData["defaults"];
}

export function ApplyDefaultConfig({ defaults }: Props) {
  const { update } = useContext(ConfigStateContext);
  useEffect(() => {
    if (!defaults) {
      return;
    }

    update(config => {
      const {
        lowerLvlBound,
        upperLvlBound,
        flags,
        difficulties,
        style
      } = defaults;
      return {
        ...config,
        lowerBound: lowerLvlBound,
        upperBound: upperLvlBound,
        flags: new Set(flags),
        difficulties: new Set(difficulties),
        style
      };
    });
  }, [defaults, update]);
  return null;
}
