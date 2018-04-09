import { Component } from 'preact';
import { DrawnSet } from './drawn-set';
import styles from './drawing-list.css';
import globalStyles from './app.css';
import { TOURNAMENT_MODE } from './utils';

export class DrawingList extends Component {
  render() {
    const { drawings } = this.props;
    if (!TOURNAMENT_MODE) {
      return this.renderScrollableDrawings(drawings);
    }

    const [nextSet, currentSet, ...pastSets] = drawings;

    return (
      <div className={styles.drawings}>
        {((nextSet || currentSet) && (
          <section>
            <div className={styles.sectionLabel}>Current Set:</div>
            {this.renderDrawing(currentSet || nextSet)}
          </section>
        ))}
        {!!nextSet && !!currentSet && (
          <section>
            <div className={styles.sectionLabel}>Up Next:</div>
            {this.renderDrawing(nextSet)}
          </section>
        )}
        {!!pastSets.length && (
          <section className={styles.drawings}>
            <div className={styles.sectionLabel}>Past sets:</div>
            {this.renderScrollableDrawings(pastSets)}
          </section>
        )}
      </div>
    );
  }

  renderScrollableDrawings(drawings) {
    return (
      <div className={styles.scrollable}>
        {drawings.map(this.renderDrawing)}
      </div>
    );
  }

  renderDrawing(drawing) {
    return (
      <DrawnSet key={drawing.id} drawing={drawing} />
    );
  }
}
