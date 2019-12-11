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
    const veto = this.props.drawing.bans.find(b => b.chartIndex === index);
    const protect = this.props.drawing.protects.find(
      b => b.chartIndex === index
    );
    const pocketPick = this.props.drawing.pocketPicks.find(
      b => b.chartIndex === index
    );
    return (
      <SongCard
        key={index}
        onVeto={this.handleBanProtectReplace.bind(
          this,
          this.props.drawing.bans,
          index
        )}
        onProtect={this.handleBanProtectReplace.bind(
          this,
          this.props.drawing.protects,
          index
        )}
        onReplace={this.handleBanProtectReplace.bind(
          this,
          this.props.drawing.pocketPicks,
          index
        )}
        vetoedBy={veto && veto.player}
        protectedBy={protect && protect.player}
        replacedBy={pocketPick && pocketPick.player}
        replacedWith={pocketPick && pocketPick.chart}
        chart={chart}
      />
    );
  };

  handleBanProtectReplace(arr, chartIndex, player, chart) {
    const existingBanIndex = arr.findIndex(b => b.chartIndex === chartIndex);
    if (existingBanIndex >= 0) {
      arr.splice(existingBanIndex, 1);
    } else {
      arr.push({ chartIndex, player, chart });
    }
    this.forceUpdate();
  }
}
