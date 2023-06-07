import { useRecoilState, useRecoilValue } from "recoil";
import { useDrawState } from "../draw-state";
import { useIntl } from "../hooks/useIntl";
import { difficulties, style } from "../config-state";
import { GameData } from "../models/SongData";
import { useMemo } from "react";
import { Checkbox, FormGroup } from "@blueprintjs/core";

function getAvailableDifficulties(gameData: GameData, selectedStyle: string) {
  let s = new Set<string>();
  for (const f of gameData.songs) {
    for (const c of f.charts) {
      if (c.style === selectedStyle) {
        s.add(c.diffClass);
      }
    }
  }
  return gameData.meta.difficulties.filter((d) => s.has(d.key));
}

export function Difficulties() {
  const { t } = useIntl();
  const selectedStyle = useRecoilValue(style);
  const [selectedDifficulties, setDifficulties] = useRecoilState(difficulties);
  const gameData = useDrawState((s) => s.gameData);
  const availableDifficulties = useMemo(() => {
    if (!gameData) {
      return [];
    }
    return getAvailableDifficulties(gameData, selectedStyle);
  }, [gameData, selectedStyle]);

  return (
    <FormGroup label={t("difficulties")}>
      {availableDifficulties.map((dif) => (
        <Checkbox
          key={`${dif.key}`}
          name="difficulties"
          value={dif.key}
          checked={selectedDifficulties.has(dif.key)}
          onChange={(e) => {
            const { checked, value } = e.currentTarget;
            setDifficulties((prev) => {
              const next = new Set(prev);
              if (checked) {
                next.add(value);
              } else {
                next.delete(value);
              }
              return next;
            });
          }}
          label={t("meta." + dif.key)}
        />
      ))}
    </FormGroup>
  );
}
