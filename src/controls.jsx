import { Component } from 'preact';
import styles from './controls.css';
import globalStyles from './app.css';

export class Controls extends Component {
  form = null;

  render() {
    return (
      <form ref={this.saveFormRef} className={styles.form} onSubmit={this.handleSubmit}>
        <div className={globalStyles.padded}>
          Number of charts to randomize:
          {' '}
          <input type='number' name='chartCount' defaultValue='5' min='1' />
        </div>
        <div className={globalStyles.padded}>
          Lower bound (inclusive):
          {' '}
          <input type='number' name='lowerBound' defaultValue='1' min='1' max='19' />
          {' '}
          Upper bound (inclusive):
          {' '}
          <input type='number' name='upperBound' defaultValue='19' min='1' max='19'/>
        </div>
        <div className={globalStyles.padded}>
          Style:
          {' '}
          <label>
            <input type='radio' name='style' value='single' defaultChecked />
            Single
          </label>
          {' '}
          <label>
            <input type='radio' name='style' value='double' />
            Double
          </label>
        </div>
        <div className={globalStyles.padded}>
          Difficulties:
          {' '}
          {[
            ['Beginner', false],
            ['Basic', false],
            ['Difficult', false],
            ['Expert', true],
            ['Challenge', true],
          ].map(([difficulty, checked]) => (
            <label>
              <input type='checkbox' name='difficulties' value={difficulty.toLowerCase()} defaultChecked={checked} />
              {difficulty + ' '}
            </label>
          ))}
        </div>
        <div className={globalStyles.padded}>
          Include:
          {' '}
          <label>
            <input type='checkbox' name='inclusions' value='extraExclusive' />Extra Exclusive songs
          </label>
          {' '}
          <label>
            <input type='checkbox' name='inclusions' value='unlock' />Unlockable songs
          </label>
          {' '}
          <label>
            <input type='checkbox' name='inclusions' value='usLocked' />Songs unavailable in the US
          </label>
          {' '}
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