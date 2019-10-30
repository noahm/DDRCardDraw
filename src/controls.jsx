import "formdata-polyfill";
import { Component } from "preact";
import { useContext } from "preact/hooks";
import styles from "./controls.css";
import globalStyles from "./app.css";
import { WeightsControls } from "./controls-weights";
import { Text } from "preact-i18n";
import { DrawStateContext } from "./draw-state";

const dataSetConfigs = {
  ace: {
    defaultState: {
      lowerBound: 13,
      upperBound: 16,
      upperMaximum: 19
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
    defaultState: {
      lowerBound: 13,
      upperBound: 16,
      upperMaximum: 19
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
    defaultState: {
      lowerBound: 6,
      upperBound: 10,
      upperMaximum: 10
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

export class ControlsImpl extends Component {
  form = null;

  constructor(props) {
    super(props);
    this.state = Object.assign(
      {
        weighted: false,
        collapsed: false
      },
      dataSetConfigs[props.dataSet].defaultState
    );
  }

  render() {
    const { dataSet } = this.props;
    const {
      collapsed,
      upperBound,
      lowerBound,
      upperMaximum,
      weighted
    } = this.state;
    const { difficulties, includables } = dataSetConfigs[dataSet];
    const abbrKeys = {};
    for (const d of difficulties) {
      abbrKeys[d.value] = d.key + ".abbreviation";
    }

    return (
      <form
        ref={this.saveFormRef}
        className={styles.form + (collapsed ? " " + styles.collapsed : "")}
        onSubmit={this.handleSubmit}
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
                <Text id="dataSource">DDR Version</Text>:{" "}
                <select name="dataSource" onChange={this.handleSongListChange}>
                  <option value="a20" defaultSelected>
                    A20
                  </option>
                  <option value="ace">Ace</option>
                  <option value="extreme">Extreme</option>
                </select>
              </label>
            </div>
            <div className={styles.group}>
              <label>
                <Text id="chartCount">Number to draw</Text>:{" "}
                <input
                  type="number"
                  name="chartCount"
                  defaultValue="5"
                  min="1"
                />
              </label>
            </div>
            <div className={styles.group}>
              <Text id="difficultyLevel">Difficulty level</Text>:
              <label>
                <Text id="upperBound">Upper bound (inclusive)</Text>:
                <input
                  type="number"
                  name="upperBound"
                  onChange={this.handleUpperBoundChange}
                  value={upperBound}
                  min={lowerBound}
                  max={upperMaximum}
                />
              </label>
              <label>
                <Text id="lowerBound">Lower bound (inclusive)</Text>:
                <input
                  type="number"
                  name="lowerBound"
                  onChange={this.handleLowerBoundChange}
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
                  onChange={this.handleWeightedChange}
                />
                <Text id="useWeightedDistributions">
                  Use Weighted Distributions
                </Text>
              </label>
            </div>
          </div>
          <div className={styles.column}>
            <div className={styles.group}>
              <label>
                <Text id="style">Style</Text>{" "}
                <select name="style">
                  <option value="single" defaultSelected>
                    <Text id="single">Single</Text>
                  </option>
                  <option value="double">
                    <Text id="double">Double</Text>
                  </option>
                </select>
              </label>
            </div>
            <div className={styles.group}>
              <Text id="difficulties">Difficulties</Text>:
              {difficulties.map(dif => (
                <label key={dif.value}>
                  <input
                    type="checkbox"
                    name="difficulties"
                    value={dif.value}
                    checked={dif.checked}
                    onChange={e => {
                      dif.checked = !!e.currentTarget.checked;
                      this.forceUpdate();
                    }}
                  />
                  <Text id={dif.key + ".name"} />
                </label>
              ))}
            </div>
          </div>
          <div className={styles.column}>
            {includables && (
              <div className={styles.group}>
                <Text id="include">Include</Text>:
                {Object.keys(includables).map(key => (
                  <label key={key}>
                    <input
                      type="checkbox"
                      name="inclusions"
                      value={key}
                      checked={includables[key]}
                      onChange={e => {
                        includables[key] = !!e.currentTarget.checked;
                        this.forceUpdate();
                      }}
                    />
                    <Text id={"controls." + key} />
                  </label>
                ))}
              </div>
            )}
            <div className={globalStyles.padded}>
              <button onClick={this.handleRandomize}>
                <Text id="draw">Draw!</Text>
              </button>{" "}
              <button
                onClick={() =>
                  this.setState(state => ({ collapsed: !state.collapsed }))
                }
              >
                <Text id={collapsed ? "controls.show" : "controls.hide"} />
              </button>
            </div>
            {!!this.props.lastDrawFailed && (
              <div>
                <Text id="controls.invalid">
                  Couldn't draw anything with current settings!
                </Text>
              </div>
            )}
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

  saveFormRef = form => {
    this.form = form;
  };

  handleWeightedChange = e => {
    this.setState({
      weighted: e.currentTarget.checked
    });
  };

  handleLowerBoundChange = e => {
    const newValue = parseInt(e.currentTarget.value, 10);
    if (newValue > this.state.upperBound) {
      return;
    }

    this.setState({
      lowerBound: newValue
    });
  };

  handleUpperBoundChange = e => {
    const newValue = parseInt(e.currentTarget.value, 10);
    if (newValue < this.state.lowerBound) {
      return;
    }

    this.setState({
      upperBound: newValue
    });
  };

  handleSubmit(e) {
    e.preventDefault();
  }

  handleSongListChange = e => {
    const game = e.currentTarget.value;
    this.props.onSongListChange(game);
    this.setState(dataSetConfigs[game]);
  };

  handleRandomize = e => {
    e.preventDefault();
    const data = new FormData(this.form);
    this.props.onDraw(data);
  };
}

export function Controls() {
  const { drawSongs, dataSet } = useContext(DrawStateContext);
  return <ControlsImpl onDraw={drawSongs} dataSet={dataSet} />;
}
