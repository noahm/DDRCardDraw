import classNames from 'classnames';
import { Component } from 'preact';
import { SongCard } from './song-card';
import styles from './drawing-list.css';
import globalStyles from './app.css';

export class DrawingList extends Component {
  render() {
    const { drawings } = this.props;
    return (
      <div className={styles.drawings}>
        {drawings.map((drawing, i) => (
          <div key={drawing.id} className={styles.chartList}>
            {drawing.charts.map((chart, j) => (
              <SongCard key={j} {...chart} />
            ))}
          </div>
        ))}
      </div>
    );
  }
}
