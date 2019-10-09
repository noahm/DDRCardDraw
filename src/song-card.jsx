import classNames from "classnames";
import { Component } from "preact";
import { detectedLanguage } from "./utils";
import styles from "./song-card.css";
import { Localizer, Text } from "preact-i18n";

const isJapanese = detectedLanguage === "ja";

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
      jacket
    } = this.props;

    const rootClassname = classNames(styles.chart, styles[difficulty], {
      [styles.vetoed]: vetoed
    });

    let jacketBg = {};
    if (jacket) {
      jacketBg = {
        backgroundImage: `linear-gradient(rgba(0, 0, 0, 0.2), rgba(0, 0, 0, 0.2)), url("jackets/${jacket}")`
      };
    }

    return (
      <div className={rootClassname} onClick={this.props.onVeto}>
        <div className={styles.cardCenter} style={jacketBg}>
          <div className={styles.name} title={nameTranslation}>
            {name}
          </div>
          {isJapanese ? null : (
            <div className={styles.nameTranslation}>{nameTranslation}</div>
          )}
          <div className={styles.artist} title={artistTranslation}>
            {artist}
          </div>
        </div>
        <div className={styles.cardFooter}>
          <div className={styles.bpm}>{bpm} BPM</div>
          {hasShock && (
            <Localizer>
              <div
                className={styles.shockBadge}
                title={<Text id="shockArrows">Shock Arrows</Text>}
              >
                <svg
                  height="100%"
                  className="octicon octicon-zap"
                  viewBox="0 0 10 16"
                  version="1.1"
                  ariaHidden="true"
                >
                  <path fillRule="evenodd" d="M10 7H6l3-7-9 9h4l-3 7 9-9z" />
                </svg>
              </div>
            </Localizer>
          )}
          <div className={styles.difficulty}>
            <Text id={abbreviation} /> {level}
          </div>
        </div>
      </div>
    );
  }

  toggleVeto = () => {
    this.setState(prevState => ({
      vetoed: !prevState.vetoed
    }));
  };
}
