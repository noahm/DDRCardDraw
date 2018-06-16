import 'formdata-polyfill';
import { Component } from 'preact';
import styles from './controls.css';
import globalStyles from './app.css';
import { times } from './utils';

const defaultStateByGame = {
  ace: {
    lowerBound: 13,
    upperBound: 16,
    upperMaximum: 19,
    difficulties: [
      { label: 'Beginner', value: 'beginner', defaultChecked: false, abbreviation: 'Beg' },
      { label: 'Basic', value: 'basic', defaultChecked: false, abbreviation: 'Bas' },
      { label: 'Difficult', value: 'difficult', defaultChecked: false, abbreviation: 'Dif' },
      { label: 'Expert', value: 'expert', defaultChecked: true, abbreviation: 'Ex' },
      { label: 'Challenge', value: 'challenge', defaultChecked: true, abbreviation: 'Ch' },
    ],
  },
  extreme: {
    lowerBound: 6,
    upperBound: 10,
    upperMaximum: 10,
    difficulties: [
      { label: 'Light', value: 'basic', defaultChecked: false, abbreviation: 'Lht' },
      { label: 'Standard', value: 'difficult', defaultChecked: false, abbreviation: 'Std' },
      { label: 'Heavy', value: 'expert', defaultChecked: true, abbreviation: 'Hvy' },
      { label: 'Challenge', value: 'challenge', defaultChecked: true, abbreviation: 'Ch' },
    ],
  },
};

export class Controls extends Component {
  state = Object.assign({
    weighted: false,
  }, defaultStateByGame.ace);

  form = null;

  render() {
    const { canPromote } = this.props;
    const abbreviations = {};
    for (const d of this.state.difficulties) {
      abbreviations[d.value] = d.abbreviation;
    }

    return (
      <form ref={this.saveFormRef} className={styles.form} onSubmit={this.handleSubmit}>
        <input type="hidden" name="abbreviations" value={JSON.stringify(abbreviations)} />
        <section className={styles.columns}>
          <div className={styles.column}>
            <div className={styles.group}>
              <label>
                Song List:
                {' '}
                <select name="dataSource" onChange={this.handleSongListChange}>
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
              {this.state.difficulties.map(({ label, value, defaultChecked }) => (
                <label key={value}>
                  <input type='checkbox' name='difficulties' value={value} defaultChecked={defaultChecked} />
                  {label}
                </label>
              ))}
            </div>
          </div>
          <div className={styles.column}>
            {this.state.upperMaximum === 19 && (
            <div className={styles.group}>
              Include:
              <label>
                <input type='checkbox' name='inclusions' value='extraExclusive' />Extra Exclusive songs
              </label>
              <label>
                <input type='checkbox' name='inclusions' value='unlock' />Unlockable songs
              </label>
              <label>
                <input type='checkbox' name='inclusions' value='usLocked' />Japan-only songs
              </label>
              <label>
                <input type='checkbox' name='inclusions' value='removed' />Removed songs
              </label>
            </div>
            )}
            <div className={globalStyles.padded}>
              <button onClick={this.handleRandomize}>Draw!</button>
              {' '}
              {canPromote && <button onClick={this.handlePromote}>Next match</button>}
            </div>
            {!!this.props.lastDrawFailed && <div>Couldn't draw anything with current settings!</div>}
          </div>
        </section>

        <section className={this.state.weighted ? styles.weights : styles.hidden}>
          <p>
            Integers only. Applies a multiplier to the chances that any song of a given difficulty level will be drawn.
          </p>
          {times(this.state.upperBound - this.state.lowerBound + 1, (n) => {
            n += this.state.lowerBound - 1;
            return (
              <label key={n}>
                <input type="number" name={`weight-${n}`} defaultValue="1" min="0" />
                {n}
              </label>
            );
          })}
        </section>
      </form>
    );
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
    this.setState(defaultStateByGame[game]);
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
