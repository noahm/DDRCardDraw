import { Component } from "preact";
import { SongCard } from "./song-card";
import styles from "./drawn-set.css";

const HUE_STEP = (255 / 8) * 3;
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
      <div
        key={drawing.id}
        className={styles.chartList}
        style={{ backgroundImage: this._background }}
      >
        {drawing.charts.map(this.renderChart)}
      </div>
    );
  }

  renderChart = (chart, index) => {
    return (
      <SongCard
        key={index}
        onVeto={this.handleVeto.bind(this, index)}
        onProtect={this.handleProtect.bind(this, index)}
        vetoed={this.props.drawing.vetos.has(index)}
        isProtected={this.props.drawing.protects.has(index)}
        {...chart}
      />
    );
  };

  handleVeto(j) {
    const drawing = this.props.drawing;
    if (drawing.vetos.has(j)) {
      drawing.vetos.delete(j);
    } else {
      drawing.vetos.add(j);
    }
    this.forceUpdate();
  }

  handleProtect(j) {
    const drawing = this.props.drawing;
    if (drawing.protects.has(j)) {
      drawing.protects.delete(j);
    } else {
      drawing.protects.add(j);
    }
    this.forceUpdate();
  }
}
