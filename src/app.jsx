import { Component, render } from 'preact';
import { Controls } from './controls';
import { DrawingList } from './drawing-list';
import { Footer } from './footer';
import { draw } from './songs/card-draw';
import styles from './app.css';

class App extends Component {
  state = {
    drawings: [],
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
        <Controls onDraw={this.doDrawing} />
        <DrawingList drawings={this.state.drawings} />
        <Footer />
      </div>
    );
  }

  doDrawing = (configData) => {
    const drawing = draw(configData);
    this.setState(prevState => ({
      drawings: [drawing].concat(prevState.drawings),
    }));
  }

  handleUnload = (e) => {
    if (this.state.drawings.length) {
      e.returnValue = 'Are you sure you want to leave?';
    }
  }
}

render(<App />, document.body);
