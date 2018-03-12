import classNames from 'classnames';
import { Component } from 'preact';
import { SongCard } from './song-card';
import styles from './drawing-list.css';
import globalStyles from './app.css';

export class DrawingList extends Component {
  render() {
    const { drawings } = this.props;
    const [nextSet, currentSet, ...pastSets] = drawings;

    return (
      <div className={styles.drawings}>
        {!!nextSet && !!currentSet && (
          <div>
            Up Next:
            {this.renderDrawing(nextSet)}
          </div>
        )}
        {(!!nextSet && (
          <div>
            Current Set:
            {this.renderDrawing(currentSet || nextSet)}
          </div>
        ))}
        {!!pastSets.length && (
          <div className={styles.drawings}>
            Past sets:
            <div className={styles.scrollable}>
              {pastSets.map(this.renderDrawing)}
            </div>
          </div>
        )}
      </div>
    );
  }

  renderDrawing(drawing, key) {
    return (
      <div key={drawing.id} className={styles.chartList}>
        {drawing.charts.map((chart, j) => (
          <SongCard key={j} {...chart} />
        ))}
      </div>
    );
  }
}
