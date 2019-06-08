import { Component } from 'preact';
import { SongCard } from './song-card';
import styles from './drawn-set.css';

const HUE_STEP = 255 / 8 * 3;
let hue = Math.floor(Math.random() * 255);

function getRandomGradiant() {
  hue += HUE_STEP;
  return `linear-gradient(hsl(${hue}, 50%, 80%), white, white)`;
}

export class DrawnSet extends Component {
  _background = getRandomGradiant();

  render() {
    const { drawing } = this.props;
    return (
      <div key={drawing.id} className={styles.chartList} style={{ backgroundImage: this._background }}>
        {drawing.charts.map(this.renderChart)}
      </div>
    );
  }

  renderChart = (chart, j) => {
    return (
      <SongCard
        key={j}
        onVeto={this.handleVeto.bind(this, j)}
        vetoed={this.props.drawing.vetos.has(j)}
        {...chart}
      />
    );
  }

  handleVeto(j) {
    const drawing = this.props.drawing;
    if (drawing.vetos.has(j)) {
      drawing.vetos.delete(j);
    } else {
      drawing.vetos.add(j);
    }
    this.forceUpdate();
  }
}
