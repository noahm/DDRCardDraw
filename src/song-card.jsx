import classNames from 'classnames';
import { Component } from 'preact';
import styles from './song-card.css';

export class SongCard extends Component {
  render() {
    const {
      name,
      nameTranslation,
      artist,
      artistTranslation,
      bpm,
      difficulty,
      level,
      hasShock,
      vetoed,
      abbreviation,
      jacket,
    } = this.props;

    const rootClassname = classNames(
      styles.chart,
      styles[difficulty],
      {
        [styles.vetoed]: vetoed,
      },
    );

    let jacketBg = {};
    if (jacket) {
      jacketBg = {
        backgroundImage: `linear-gradient(rgba(0, 0, 0, 0.2), rgba(0, 0, 0, 0.2)), url("jackets/${jacket}")`,
      };
    }

    return (
      <div className={rootClassname} style={jacketBg} onClick={this.props.onVeto}>
        <div className={styles.cardCenter}>
          <div className={styles.name} title={nameTranslation}>
            {name}
          </div>
          <div className={styles.nameTranslation}>
            {nameTranslation}
          </div>
          <div className={styles.artist} title={artistTranslation}>
            {artist}
          </div>
        </div>
        <div className={styles.cardFooter}>
          <div className={styles.bpm}>{bpm} BPM</div>
          {hasShock && <div className={styles.shockBadge} title="Shock Arrows">&#9889;</div>}
          <div className={styles.difficulty}>{abbreviation} {level}</div>
        </div>
      </div>
    );
  }

  toggleVeto = () => {
    this.setState((prevState) => ({
      vetoed: !prevState.vetoed,
    }));
  }
}
