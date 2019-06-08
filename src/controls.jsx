import 'formdata-polyfill';
import { Component } from 'preact';
import styles from './controls.css';
import globalStyles from './app.css';
import { WeightsControls } from './controls-weights';

const dataSetConfigs = {
  ace: {
    lowerBound: 13,
    upperBound: 16,
    upperMaximum: 19,
    difficulties: [
      { label: 'Beginner', value: 'beginner',checked: false, abbreviation: 'Beg' },
      { label: 'Basic', value: 'basic', checked: false, abbreviation: 'Bas' },
      { label: 'Difficult', value: 'difficult', checked: false, abbreviation: 'Dif' },
      { label: 'Expert', value: 'expert', checked: true, abbreviation: 'Exp' },
      { label: 'Challenge', value: 'challenge', checked: true, abbreviation: 'Cha' },
    ],
    includables: {
      unlock: true,
      extraExclusive: false,
      tempUnlock: false,
      usLocked: false,
      removed: false,
    },
  },
  a20: {
    lowerBound: 13,
    upperBound: 16,
    upperMaximum: 19,
    difficulties: [
      { label: 'Beginner', value: 'beginner',checked: false, abbreviation: 'Beg' },
      { label: 'Basic', value: 'basic', checked: false, abbreviation: 'Bas' },
      { label: 'Difficult', value: 'difficult', checked: false, abbreviation: 'Dif' },
      { label: 'Expert', value: 'expert', checked: true, abbreviation: 'Exp' },
      { label: 'Challenge', value: 'challenge', checked: true, abbreviation: 'Cha' },
    ],
    includables: {
      unlock: false,
      extraExclusive: false,
      tempUnlock: false,
    },
  },
  extreme: {
    lowerBound: 6,
    upperBound: 10,
    upperMaximum: 10,
    difficulties: [
      { label: 'Light', value: 'basic', checked: false, abbreviation: 'Lt' },
      { label: 'Standard', value: 'difficult', checked: false, abbreviation: 'Std' },
      { label: 'Heavy', value: 'expert', checked: true, abbreviation: 'Hvy' },
      { label: 'Challenge', value: 'challenge', checked: true, abbreviation: 'Ch' },
    ],
    includables: null,
  },
};
const DEFAULT_DATA_SET = 'ace';

const INCLUDABLE_OPTIONS = {
  unlock: 'Unlockable songs',
  tempUnlock: 'Formerly unlockable (SDVX)',
  extraExclusive: 'Final/Extra Exclusive',
  usLocked: 'Japan-only songs',
  removed: 'Removed songs',
};

export class Controls extends Component {
  state = Object.assign({
    weighted: false,
    collapsed: false,
  }, dataSetConfigs[DEFAULT_DATA_SET]);

  form = null;

  render() {
    const { canPromote } = this.props;
    const { collapsed, difficulties } = this.state;
    const abbreviations = {};
    for (const d of difficulties) {
      abbreviations[d.value] = d.abbreviation;
    }

    return (
      <form ref={this.saveFormRef} className={styles.form + (collapsed ? ' ' + styles.collapsed : '')} onSubmit={this.handleSubmit}>
        <input type="hidden" name="abbreviations" value={JSON.stringify(abbreviations)} />
        <section className={styles.columns}>
          <div className={styles.column}>
            <div className={styles.group}>
              <label>
                DDR Version:
                {' '}
                <select name="dataSource" onChange={this.handleSongListChange}>
                  <option value="a20">A20</option>
                  <option value="ace" defaultSelected>Ace</option>
                  <option value="extreme">Extreme</option>
                </select>
              </label>
            </div>
            <div className={styles.group}>
              <label>
                Number to draw:
                {' '}
                <input type='number' name='chartCount' defaultValue='5' min='1' />
              </label>
            </div>
            <div className={styles.group}>
              Difficulty level:
              <label>
                Upper bound (inclusive):
                <input
                  type='number'
                  name='upperBound'
                  onChange={this.handleUpperBoundChange}
                  value={this.state.upperBound}
                  min={this.state.lowerBound}
                  max={this.state.upperMaximum}
                />
              </label>
              <label>
                Lower bound (inclusive):
                <input
                  type='number'
                  name='lowerBound'
                  onChange={this.handleLowerBoundChange}
                  value={this.state.lowerBound}
                  min='1'
                  max={this.state.upperBound}
                />
              </label>
            </div>
            <div className={styles.group}>
              <label>
                <input type="checkbox" name="weighted" checked={this.state.weighted} onChange={this.handleWeightedChange} />
                Use Weighted Distributions
              </label>
            </div>
          </div>
          <div className={styles.column}>
            <div className={styles.group}>
              <label>
                {'Style: '}
                <select name="style">
                  <option value="single" defaultSelected>Single</option>
                  <option value="double">Double</option>
                </select>
              </label>
            </div>
            <div className={styles.group}>
              Difficulties:
              {difficulties.map((dif) => (
                <label key={dif.value}>
                  <input
                    type='checkbox'
                    name='difficulties'
                    value={dif.value}
                    checked={dif.checked}
                    onChange={(e) => {
                      dif.checked = !!e.currentTarget.checked;
                      this.forceUpdate();
                    }}
                  />
                  {dif.label}
                </label>
              ))}
            </div>
          </div>
          {collapsed && this.renderSettingsSummary()}
          <div className={styles.column}>
            {this.state.includables && (
            <div className={styles.group}>
              Include:
              {Object.keys(this.state.includables).map(key => (
                <label key={key}>
                  <input
                    type="checkbox"
                    name="inclusions"
                    value={key}
                    checked={this.state.includables[key]}
                    onChange={e => {
                      this.state.includables[key] = !!e.currentTarget.checked;
                      this.forceUpdate();
                    }}
                  />
                  {INCLUDABLE_OPTIONS[key]}
                </label>
              ))}
            </div>
            )}
            <div className={globalStyles.padded}>
              <button onClick={this.handleRandomize}>Draw!</button>
              {' '}
              {canPromote && <button onClick={this.handlePromote}>Next match</button>}
              {' '}
              <button onClick={() => this.setState((state) => ({ collapsed: !state.collapsed }))}>{collapsed ? 'Show' : 'Hide'} controls</button>
            </div>
            {!!this.props.lastDrawFailed && <div>Couldn't draw anything with current settings!</div>}
          </div>
        </section>

        <WeightsControls
          hidden={!this.state.weighted || collapsed}
          high={this.state.upperBound}
          low={this.state.lowerBound}
        />
      </form>
    );
  }

  renderSettingsSummary() {
    const formState = new FormData(this.form);
    const chartCount = formState.get('chartCount');
    const high = +formState.get('upperBound');
    const low = +formState.get('lowerBound');
    let levelRange = `${low}-${high}`;
    if (low === high) {
      levelRange = low.toString();
    }

    // natural language list of difficulties
    const difficulties = formState.getAll('difficulties').map(d => this.state.difficulties.find(dd => dd.value === d).label);
    if (difficulties.length > 2) {
      difficulties[difficulties.length - 1] = 'or ' + difficulties[difficulties.length - 1];
    }
    const difficultyList = difficulties.join(difficulties.length < 3 ? ' or ' : ', ');

    // natural language list of inclusions
    const inclusions = formState.getAll('inclusions').map(k => INCLUDABLE_OPTIONS[k].toLowerCase());
    if (inclusions.length > 2) {
      inclusions[inclusions.length - 1] = 'and ' + inclusions[inclusions.length - 1];
    }
    const inclusionList = inclusions.join(inclusions.length < 3 ? ' and ' : ', ');

    // build list of configured weights
    const weighted = !!formState.get('weighted');
    let totalWeight = 0;
    let weights = [];
    if (weighted) {
      // build an array of possible levels to pick from
      for (let level = low; level <= high; level++) {
        const weight = +formState.get(`weight-${level}`);
        if (weight) {
          totalWeight += weight;
          weights.push({
            level,
            value: weight,
          });
        }
      }
      for (const weight of weights) {
        weight.percentage = weight.value ? (100 * weight.value / totalWeight).toFixed(0) : 0;
      }
    }

    return <div className={globalStyles.padded}>
      Drawing {chartCount} {difficultyList} charts {weighted && 'with draw chance by'} lvl
      {weighted ? (': (' + weights.map(w => `${w.level}: ${w.percentage}%`).join(', ') + ')') : (` ${levelRange}`)}
      {!!inclusions.length && (
        ' including ' + inclusionList
      )}
      .
    </div>;
  }

  saveFormRef = (form) => {
    this.form = form;
  }

  handleWeightedChange = (e) => {
    this.setState({
      weighted: e.currentTarget.checked,
    });
  }

  handleLowerBoundChange = (e) => {
    const newValue = parseInt(e.currentTarget.value, 10);
    if (newValue > this.state.upperBound) {
      return;
    }

    this.setState({
      lowerBound: newValue,
    });
  }

  handleUpperBoundChange = (e) => {
    const newValue = parseInt(e.currentTarget.value, 10);
    if (newValue < this.state.lowerBound) {
      return;
    }

    this.setState({
      upperBound: newValue,
    });
  }

  handleSubmit(e) {
    e.preventDefault();
  }

  handleSongListChange = (e) => {
    const game = e.currentTarget.value;
    this.props.onSongListChange(game);
    this.setState(dataSetConfigs[game]);
  }

  handleRandomize = (e) => {
    e.preventDefault();
    const data = new FormData(this.form);
    this.props.onDraw(data);
  }

  handlePromote = (e) => {
    e.preventDefault();
    this.props.onPromote();
  }
}
