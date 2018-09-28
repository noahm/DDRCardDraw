import classNames from 'classnames';
import styles from './footer.css';
import globalStyles from './app.css';

export function Footer() {
  return (
    <div className={classNames(styles.footer, globalStyles.padded)}>
      By Jeff Lloyd, Chris Chike, and Noah Manneschmidt. Songs up to date as of 09/27/2018. Report bugs via <a href="https://twitter.com/Cathadan" target="_blank">Twitter</a> or <a href="https://github.com/noahm/DDRCardDraw">GitHub</a>.
    </div>
  );
}
