import { Component } from 'preact';
import { SongCard } from './song-card';
import styles from './drawn-set.css';

export class DrawnSet extends Component {
  render() {
    const { drawing } = this.props;
    return (
      <div key={drawing.id} className={styles.chartList}>
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
