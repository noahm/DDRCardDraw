import classNames from "classnames";
import { TranslateContext } from "@denysvuika/preact-translate";
import { useContext, useMemo, useRef, useState } from "preact/hooks";
import globalStyles from "../app.css";
import { WeightsControls } from "./controls-weights";
import styles from "./controls.css";
import { DrawStateContext } from "../draw-state";
import { JSXInternal } from "preact/src/jsx";
import { ConfigStateContext } from "../config-state";
import { GameData } from "../models/SongData";

function preventDefault(e: Event) {
  e.preventDefault();
}

const DATA_FILES = (process.env.DATA_FILES as unknown) as Array<{
  name: string;
  display: string;
}>;

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

export function Controls() {
  const form = useRef<HTMLFormElement>(null);
  const [collapsed, setCollapsed] = useState(true);
  const { t } = useContext(TranslateContext);
  const {
    drawSongs,
    dataSetName,
    loadGameData,
    lastDrawFailed,
    gameData,
  } = useContext(DrawStateContext);
  const configState = useContext(ConfigStateContext);
  const {
    useWeights,
    lowerBound,
    upperBound,
    update: updateState,
    difficulties: selectedDifficulties,
    flags: selectedFlags,
    style: selectedStyle,
    chartCount,
    showPool,
  } = configState;
  const availableDifficulties = useMemo(() => {
    if (!gameData) {
      return [];
    }
    return getAvailableDifficulties(gameData, selectedStyle);
  }, [gameData, selectedStyle]);
  if (!gameData) {
    return null;
  }
  const { flags, lvlMax, styles: gameStyles } = gameData.meta;

  const handleLowerBoundChange = (
    e: JSXInternal.TargetedEvent<HTMLInputElement>
  ) => {
    const newValue = parseInt(e.currentTarget.value, 10);
    if (newValue > upperBound) {
      return;
    }
    updateState((state) => {
      return {
        ...state,
        lowerBound: newValue,
      };
    });
  };

  const handleUpperBoundChange = (
    e: JSXInternal.TargetedEvent<HTMLInputElement>
  ) => {
    const newValue = parseInt(e.currentTarget.value, 10);
    if (newValue < lowerBound) {
      return;
    }
    updateState((state) => {
      return {
        ...state,
        upperBound: newValue,
      };
    });
  };

  const handleSongListChange = (
    e: JSXInternal.TargetedEvent<HTMLSelectElement>
  ) => {
    loadGameData(e.currentTarget.value);
  };

  const handleRandomize = (e: JSXInternal.TargetedEvent<HTMLButtonElement>) => {
    e.preventDefault();
    if (showPool) {
      updateState((state) => ({
        ...state,
        showPool: false,
      }));
    }
    drawSongs(configState);
  };

  return (
    <form
      ref={form}
      className={styles.form + (collapsed ? " " + styles.collapsed : "")}
      onSubmit={preventDefault}
    >
      <section className={styles.columns}>
        <div className={styles.column}>
          <div className={styles.group}>
            <label>
              {t("dataSource")}:{" "}
              <select
                name="dataSource"
                onChange={handleSongListChange}
                value={dataSetName}
              >
                {DATA_FILES.map(({ name, display }) => (
                  <option value={name} key={name}>
                    {display}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className={styles.group}>
            <label>
              {t("chartCount")}:{" "}
              <input
                type="number"
                name="chartCount"
                value={chartCount}
                min="1"
                onInput={(e) => {
                  updateState((s) => {
                    return { ...s, chartCount: +e.currentTarget.value };
                  });
                }}
              />
            </label>
          </div>
          <div className={styles.group}>
            {t("difficultyLevel")}:
            <label>
              {t("upperBound")}:
              <input
                type="number"
                name="upperBound"
                onChange={handleUpperBoundChange}
                value={upperBound}
                min={lowerBound}
                max={lvlMax}
              />
            </label>
            <label>
              {t("lowerBound")}:
              <input
                type="number"
                name="lowerBound"
                onChange={handleLowerBoundChange}
                value={lowerBound}
                min="1"
                max={upperBound}
              />
            </label>
          </div>
          <div className={styles.group}>
            <label>
              <input
                type="checkbox"
                name="weighted"
                checked={useWeights}
                onChange={(e) =>
                  updateState((state) => ({
                    ...state,
                    useWeights: !!e.currentTarget.checked,
                  }))
                }
              />
              {t("useWeightedDistributions")}
            </label>
          </div>
        </div>
        <div className={styles.column}>
          {gameStyles.length > 1 && (
            <div className={styles.group}>
              <label>
                {t("style")}{" "}
                <select
                  name="style"
                  value={selectedStyle}
                  onInput={(e) => {
                    updateState((s) => {
                      const nextStyle = e.currentTarget.value;
                      const availableDifficulties = getAvailableDifficulties(
                        gameData,
                        nextStyle
                      );
                      let chosenDifficulties = s.difficulties;
                      if (
                        !availableDifficulties.some((d) =>
                          chosenDifficulties.has(d.key)
                        )
                      ) {
                        chosenDifficulties = new Set(
                          gameData.defaults.difficulties
                        );
                      }

                      if (
                        !availableDifficulties.some((d) =>
                          chosenDifficulties.has(d.key)
                        )
                      ) {
                        chosenDifficulties = new Set(
                          availableDifficulties.map((d) => d.key)
                        );
                      }
                      return {
                        ...s,
                        style: nextStyle,
                        difficulties: chosenDifficulties,
                      };
                    });
                  }}
                >
                  {gameStyles.map((style) => (
                    <option key={style} value={style}>
                      {t("meta." + style)}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          )}
          <div className={styles.group}>
            {t("difficulties")}:
            {availableDifficulties.map((dif) => (
              <label key={`${dataSetName}:${dif.key}`}>
                <input
                  type="checkbox"
                  name="difficulties"
                  value={dif.key}
                  checked={selectedDifficulties.has(dif.key)}
                  onInput={(e) => {
                    updateState((s) => {
                      const difficulties = new Set(s.difficulties);
                      if (e.currentTarget.checked) {
                        difficulties.add(e.currentTarget.value);
                      } else {
                        difficulties.delete(e.currentTarget.value);
                      }
                      return { ...s, difficulties };
                    });
                  }}
                />
                {t("meta." + dif.key)}
              </label>
            ))}
          </div>
        </div>
        <div className={styles.column}>
          {!!flags.length && (
            <div className={styles.group}>
              {t("include")}:
              {flags.map((key) => (
                <label key={`${dataSetName}:${key}`}>
                  <input
                    type="checkbox"
                    name="inclusions"
                    value={key}
                    checked={selectedFlags.has(key)}
                    onInput={(e) =>
                      updateState((s) => {
                        const newFlags = new Set(s.flags);
                        if (newFlags.has(key)) {
                          newFlags.delete(key);
                        } else {
                          newFlags.add(key);
                        }
                        return { ...s, flags: newFlags };
                      })
                    }
                  />
                  {t("meta." + key)}
                </label>
              ))}
            </div>
          )}
          <div className={styles.group}>
            <label>
              <input
                type="checkbox"
                name="showPool"
                checked={showPool}
                onChange={(e) =>
                  updateState((state) => ({
                    ...state,
                    showPool: !!e.currentTarget.checked,
                  }))
                }
              />
              {t("showSongPool")}
            </label>
          </div>
          <div className={classNames(globalStyles.padded, styles.buttons)}>
            <button onClick={handleRandomize}>{t("draw")}</button>{" "}
            <button onClick={() => setCollapsed(!collapsed)}>
              {t(collapsed ? "controls.show" : "controls.hide")}
            </button>
          </div>
          {!!lastDrawFailed && <div>{t("controls.invalid")}</div>}
        </div>
      </section>

      {useWeights && !collapsed && (
        <WeightsControls high={upperBound} low={lowerBound} />
      )}
    </form>
  );
}
