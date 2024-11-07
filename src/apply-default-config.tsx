import { GameData } from "./models/SongData";
import { useEffect } from "react";
import { ConfigState, useConfigState } from "./config-state";

interface Props {
  defaults?: GameData["defaults"];
  granularResolution: number | undefined;
}

export function ApplyDefaultConfig({ defaults, granularResolution }: Props) {
  useEffect(() => {
    if (!defaults) {
      return;
    }

    useConfigState.setState(() => {
      const {
        lowerLvlBound,
        upperLvlBound,
        flags,
        difficulties,
        folders,
        style,
      } = defaults;
      const ret: Partial<ConfigState> = {
        lowerBound: lowerLvlBound,
        upperBound: upperLvlBound,
        flags: new Set(flags),
        difficulties: new Set(difficulties),
        folders: new Set(folders),
        style,
        cutoffDate: "",
      };
      if (!granularResolution) {
        ret.useGranularLevels = false;
      }
      return ret;
    });
  }, [defaults, granularResolution]);
  return null;
}
