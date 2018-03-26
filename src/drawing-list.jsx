import classNames from 'classnames';
import { Component } from 'preact';
import { DrawnSet } from './drawn-set';
import styles from './drawing-list.css';
import globalStyles from './app.css';

export class DrawingList extends Component {
  render() {
    const { drawings } = this.props;
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
            <div className={styles.scrollable}>
              {pastSets.map(this.renderDrawing)}
            </div>
          </section>
        )}
      </div>
    );
  }

  renderDrawing(drawing) {
    return (
      <DrawnSet key={drawing.id} drawing={drawing} />
    );
  }
}
