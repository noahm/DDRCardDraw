import * as classNames from 'classnames';
import 'formdata-polyfill';
import { Component } from 'preact';
import styles from './controls.css';
import globalStyles from './app.css';
import { times } from './utils';

export class Controls extends Component {
  state = {
    weighted: false,
    lowerBound: 1,
    upperBound: 19,
  };

  form = null;

  render() {
    return (
      <form ref={this.saveFormRef} className={styles.form} onSubmit={this.handleSubmit}>
        <section className={styles.columns}>
          <div className={globalStyles.padded}>
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
                max='19'
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
          <div>
            <label>
              <input type="checkbox" name="weighted" checked={this.state.weighted} onChange={this.handleWeightedChange} />
              Use Weighted Distributions
            </label>
          </div>
          <div className={globalStyles.padded}>
            <label>
              Style:
              <select name="style">
                <option value="single" defaultSelected>Single</option>
                <option value="double">Double</option>
              </select>
            </label>
          </div>
          <div className={styles.group}>
            Difficulties:
            {[
              ['Beginner', false],
              ['Basic', false],
              ['Difficult', false],
              ['Expert', true],
              ['Challenge', true],
            ].map(([difficulty, checked]) => (
              <label>
                <input type='checkbox' name='difficulties' value={difficulty.toLowerCase()} defaultChecked={checked} />
                {difficulty}
              </label>
            ))}
          </div>
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
          <div className={globalStyles.padded}>
            <button onClick={this.handleRandomize}>Randomize!</button>
          </div>
          {!!this.props.lastDrawFailed && <div>Couldn't draw anything with current settings!</div>}
        </section>

        <section className={this.state.weighted ? styles.weights : styles.hidden}>
          {times(this.state.upperBound - this.state.lowerBound + 1, (n) => {
            n += this.state.lowerBound - 1;
            return (
              <label key={n}>
                <input type="number" name={`weight-${n}`} defaultValue="1" min="0" />
                {('00'+n.toString()).slice(-2) /* zero pad to two digits */}
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

  handleRandomize = (e) => {
    e.preventDefault();
    const data = new FormData(this.form);
    this.props.onDraw(data);
  }
}
