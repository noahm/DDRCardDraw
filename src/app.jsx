import { Component, render } from 'preact';
import { Controls } from './controls';
import { DrawingList } from './drawing-list';
import { Footer } from './footer';
import { draw } from './songs/card-draw';
import styles from './app.css';

class App extends Component {
  state = {
    drawings: [],
    lastDrawFailed: false,
  };

  componentDidMount() {
    window.addEventListener('beforeunload', this.handleUnload);
  }

  componentWillUnmount() {
    window.removeEventListener('beforeunload', this.handleUnload);
  }

  render() {
    return (
      <div className={styles.container}>
        <Controls
          onDraw={this.doDrawing}
          // onClear={this.handleClear}
          onPromote={this.handlePromote}
          lastDrawFailed={this.state.lastDrawFailed}
        />
        <DrawingList drawings={this.state.drawings} />
        <Footer />
      </div>
    );
  }

  doDrawing = (configData) => {
    const drawing = draw(configData);
    if (!drawing.charts.length) {
      this.setState({
        lastDrawFailed: true,
      });
      return;
    }

    this.setState(prevState => ({
      drawings: [drawing].concat(prevState.drawings).filter(Boolean),
      lastDrawFailed: false,
    }));
  }

  handlePromote = () => {
    if (!this.state.drawings.length || !this.state.drawings[0]) {
      return;
    }

    this.setState(prevState => ({
      drawings: [null].concat(prevState.drawings),
      lastDrawFailed: false,
    }));
  }

  handleUnload = (e) => {
    if (this.state.drawings.length) {
      e.returnValue = 'Are you sure you want to leave?';
    }
  }
}

render(<App />, document.body);
