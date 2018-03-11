import classNames from 'classnames';
import { Component } from 'preact';
import styles from './song-card.css';

export class SongCard extends Component {
  state = {
    vetoed: false,
  };

  render() {
    const {
      name,
      nameTranslation,
      artist,
      artistTranslation,
      bpm,
      difficulty,
      rating,
    } = this.props;

    const rootClassname = classNames(
      styles.chart,
      styles[difficulty],
      {
        [styles.vetoed]: this.state.vetoed,
      },
    );

    return (
      <div className={rootClassname} onClick={this.toggleVeto}>
        <div className={styles.name}>
          {name}
          {!!nameTranslation && (
            <div>[{nameTranslation}]</div>
          )}
        </div>
        <div className={styles.artist}>
          {artist}
          {!!artistTranslation && (
            <div>[{artistTranslation}]</div>
          )}
        </div>
        <div className={styles.bpm}>{bpm} BPM</div>
        <div className={styles.difficulty}>{difficulty} {rating}</div>
      </div>
    );
  }

  toggleVeto = () => {
    this.setState((prevState) => ({
      vetoed: !prevState.vetoed,
    }));
  }
}