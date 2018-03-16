import classNames from 'classnames';
import styles from './footer.css';
import globalStyles from './app.css';

export function Footer(props) {
  return (
    <div className={classNames(styles.footer, globalStyles.padded)}>
      By Jeff Lloyd and Noah Manneschmidt. Songs up to date as of 03/15/2018. <a href="https://github.com/noahm/DDRCardDraw">View on GitHub</a>
    </div>
  );
}
