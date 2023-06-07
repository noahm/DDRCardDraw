import { FormGroup, HTMLSelect } from "@blueprintjs/core";
import { useDrawState } from "../draw-state";
import { difficulties, levelBounds, style } from "../config-state";
import { useRecoilTransaction_UNSTABLE, useRecoilValue } from "recoil";
import { GameData } from "../models/SongData";
import { useIntl } from "../hooks/useIntl";

function getDiffsAndRangeForNewStyle(
  gameData: GameData,
  selectedStyle: string
) {
  let s = new Set<string>();
  const range = { high: 0, low: 100 };
  for (const f of gameData.songs) {
    for (const c of f.charts) {
      if (c.style === selectedStyle) {
        s.add(c.diffClass);
        if (c.lvl > range.high) {
          range.high = c.lvl;
        }
        if (c.lvl < range.low) {
          range.low = c.lvl;
        }
      }
    }
  }
  return {
    diffs: gameData.meta.difficulties.filter((d) => s.has(d.key)),
    lvlRange: range,
  };
}

export function GameStyles() {
  const { t } = useIntl();
  const gameStyles = useDrawState((s) => s.gameData?.meta.styles);
  const selectedStyle = useRecoilValue(style);
  const updateSelectedStyle = useRecoilTransaction_UNSTABLE(
    (api) => async (next: string) => {
      api.set(style, next);
      const { diffs, lvlRange } = getDiffsAndRangeForNewStyle(
        useDrawState.getState().gameData!,
        next
      );
      if (diffs.length === 1) {
        api.set(difficulties, new Set(diffs.map((d) => d.key)));
      }
      const [currLow, currHigh] = api.get(levelBounds);
      if (lvlRange.low > currHigh) {
        api.set<[number, number]>(levelBounds, (curr) => [
          curr[0],
          lvlRange.low,
        ]);
      }
      if (lvlRange.high < currLow) {
        api.set<[number, number]>(levelBounds, (curr) => [
          lvlRange.high,
          curr[1],
        ]);
      }
    },
    []
  );

  if (!gameStyles || gameStyles.length <= 1) {
    return null;
  }

  return (
    <FormGroup labelFor="style" label={t("style")}>
      <HTMLSelect
        id="style"
        large
        value={selectedStyle}
        onChange={(e) => {
          updateSelectedStyle(e.currentTarget.value);
        }}
      >
        {gameStyles.map((style) => (
          <option key={style} value={style}>
            {t("meta." + style)}
          </option>
        ))}
      </HTMLSelect>
    </FormGroup>
  );
}
