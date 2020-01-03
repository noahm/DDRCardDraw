import classNames from "classnames";
import { TranslateContext } from "@denysvuika/preact-translate";
import "formdata-polyfill";
import { useContext, useRef, useState } from "preact/hooks";
import globalStyles from "./app.css";
import { WeightsControls } from "./controls-weights";
import styles from "./controls.css";
import { DrawStateContext } from "./draw-state";
import { UncontrolledCheckbox, UncontrolledInput } from "./uncontrolled";
import { JSXInternal } from "preact/src/jsx";

const dataSetConfigs = {
  ace: {
    upperMaximum: 19,
    defaultState: {
      lowerBound: 13,
      upperBound: 16
    },
    difficulties: [
      {
        key: "difficulty.ace.beg",
        value: "beginner",
        checked: false
      },
      {
        key: "difficulty.ace.bas",
        value: "basic",
        checked: false
      },
      {
        key: "difficulty.ace.dif",
        value: "difficult",
        checked: false
      },
      { key: "difficulty.ace.exp", value: "expert", checked: true },
      {
        key: "difficulty.ace.cha",
        value: "challenge",
        checked: true
      }
    ],
    includables: {
      unlock: true,
      extraExclusive: false,
      tempUnlock: false,
      usLocked: false,
      removed: false
    }
  },
  a20: {
    upperMaximum: 19,
    defaultState: {
      lowerBound: 13,
      upperBound: 16
    },
    difficulties: [
      {
        key: "difficulty.ace.beg",
        value: "beginner",
        checked: false
      },
      {
        key: "difficulty.ace.bas",
        value: "basic",
        checked: false
      },
      {
        key: "difficulty.ace.dif",
        value: "difficult",
        checked: false
      },
      { key: "difficulty.ace.exp", value: "expert", checked: true },
      {
        key: "difficulty.ace.cha",
        value: "challenge",
        checked: true
      }
    ],
    includables: {
      unlock: false,
      goldExclusive: false,
      extraExclusive: false,
      tempUnlock: false
    }
  },
  extreme: {
    upperMaximum: 10,
    defaultState: {
      lowerBound: 6,
      upperBound: 10
    },
    difficulties: [
      {
        key: "difficulty.extreme.bas",
        value: "basic",
        checked: false
      },
      {
        key: "difficulty.extreme.dif",
        value: "difficult",
        checked: false
      },
      {
        key: "difficulty.extreme.exp",
        value: "expert",
        checked: true
      },
      {
        key: "difficulty.extreme.cha",
        value: "challenge",
        checked: true
      }
    ],
    includables: null
  }
};

function preventDefault(e: Event) {
  e.preventDefault();
}

export function Controls() {
  const { t } = useContext(TranslateContext);
  const { drawSongs, dataSetName, loadGameData, lastDrawFailed } = useContext(
    DrawStateContext
  );
  const {
    difficulties,
    includables,
    defaultState,
    upperMaximum
  } = dataSetConfigs[dataSetName as keyof typeof dataSetConfigs];
  const form = useRef<HTMLFormElement>();
  const [collapsed, setCollapsed] = useState(true);
  const [weighted, setWeighted] = useState(false);
  const [lowerBound, setLowerBound] = useState(defaultState.lowerBound);
  const [upperBound, setUpperBound] = useState(defaultState.upperBound);

  const abbrKeys: Record<string, string> = {};
  for (const d of difficulties) {
    abbrKeys[d.value] = d.key + ".abbreviation";
  }

  const handleLowerBoundChange = (
    e: JSXInternal.TargetedEvent<HTMLInputElement>
  ) => {
    const newValue = parseInt(e.currentTarget.value, 10);
    if (newValue > upperBound) {
      return;
    }
    setLowerBound(newValue);
  };

  const handleUpperBoundChange = (
    e: JSXInternal.TargetedEvent<HTMLInputElement>
  ) => {
    const newValue = parseInt(e.currentTarget.value, 10);
    if (newValue < lowerBound) {
      return;
    }
    setUpperBound(newValue);
  };

  const handleSongListChange = (
    e: JSXInternal.TargetedEvent<HTMLSelectElement>
  ) => {
    const game = e.currentTarget.value as keyof typeof dataSetConfigs;
    const newDefaults = dataSetConfigs[game].defaultState;
    setLowerBound(newDefaults.lowerBound);
    setUpperBound(newDefaults.upperBound);
    loadGameData(game);
  };

  const handleRandomize = (e: JSXInternal.TargetedEvent<HTMLButtonElement>) => {
    e.preventDefault();
    const data = new FormData(form.current);
    drawSongs(data);
  };

  return (
    <form
      ref={form}
      className={styles.form + (collapsed ? " " + styles.collapsed : "")}
      onSubmit={preventDefault}
    >
      <input
        type="hidden"
        name="abbreviations"
        value={JSON.stringify(abbrKeys)}
      />
      <section className={styles.columns}>
        <div className={styles.column}>
          <div className={styles.group}>
            <label>
              {t("dataSource")}:{" "}
              <select name="dataSource" onChange={handleSongListChange}>
                <option value="a20">A20</option>
                <option value="ace">Ace</option>
                <option value="extreme">Extreme</option>
              </select>
            </label>
          </div>
          <div className={styles.group}>
            <label>
              {t("chartCount")}:{" "}
              <UncontrolledInput
                type="number"
                name="chartCount"
                defaultValue="5"
                min="1"
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
                max={upperMaximum}
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
                checked={weighted}
                onChange={e => setWeighted(!!e.currentTarget.checked)}
              />
              {t("useWeightedDistributions")}
            </label>
          </div>
        </div>
        <div className={styles.column}>
          <div className={styles.group}>
            <label>
              {t("style")}{" "}
              <select name="style">
                <option value="single">{t("single")}</option>
                <option value="double">{t("double")}</option>
              </select>
            </label>
          </div>
          <div className={styles.group}>
            {t("difficulties")}:
            {difficulties.map(dif => (
              <label key={`${dataSetName}:${dif.value}`}>
                <UncontrolledCheckbox
                  name="difficulties"
                  value={dif.value}
                  defaultChecked={dif.checked}
                />
                {t(dif.key + ".name")}
              </label>
            ))}
          </div>
        </div>
        <div className={styles.column}>
          {includables && (
            <div className={styles.group}>
              {t("include")}:
              {Object.keys(includables).map(key => (
                <label key={`${dataSetName}:${key}`}>
                  <UncontrolledCheckbox
                    name="inclusions"
                    value={key}
                    defaultChecked={
                      includables[key as keyof typeof includables]
                    }
                  />
                  {t("controls." + key)}
                </label>
              ))}
            </div>
          )}
          <div className={classNames(globalStyles.padded, styles.buttons)}>
            <button onClick={handleRandomize}>{t("draw")}</button>{" "}
            <button onClick={() => setCollapsed(!collapsed)}>
              {t(collapsed ? "controls.show" : "controls.hide")}
            </button>
          </div>
          {!!lastDrawFailed && <div>{t("controls.invalid")}</div>}
        </div>
      </section>

      <WeightsControls
        hidden={!weighted || collapsed}
        high={upperBound}
        low={lowerBound}
      />
    </form>
  );
}
