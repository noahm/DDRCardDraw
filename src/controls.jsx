import 'formdata-polyfill';
import { Component } from 'preact';
import styles from './controls.css';
import globalStyles from './app.css';

export class Controls extends Component {
  form = null;

  render() {
    return (
      <form ref={this.saveFormRef} className={styles.form} onSubmit={this.handleSubmit}>
        <div className={globalStyles.padded}>
          <label>
            Number to draw:
            {' '}
            <input type='number' name='chartCount' defaultValue='5' min='1' />
          </label>
        </div>
        <div className={globalStyles.padded}>
          Difficulty level:
          <label>
            Lower bound (inclusive):
            <input type='number' name='lowerBound' defaultValue='1' min='1' max='19' />
          </label>
          <label>
            Upper bound (inclusive):
            <input type='number' name='upperBound' defaultValue='19' min='1' max='19'/>
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
        <div className={globalStyles.padded}>
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
        <div className={globalStyles.padded}>
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
      </form>
    );
  }

  saveFormRef = (form) => {
    this.form = form;
  }

  handleSubmit(e) {
    e.preventDefault();
  }

  handleRandomize = (e) => {
    e.preventDefault();
    const data = new FormData(this.form);
    // for (const field of data) {
    //   console.log(field);
    // }
    this.props.onDraw(data);
  }
}