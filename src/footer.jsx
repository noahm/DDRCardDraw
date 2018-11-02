import classNames from 'classnames';
import styles from './footer.css';
import globalStyles from './app.css';

export function Footer() {
  return (
    <div className={classNames(styles.footer, globalStyles.padded)}>
      Songs up to date as of 10/25/2018. Report bugs via <a href="https://twitter.com/Cathadan" target="_blank">Twitter</a> or <a href="https://github.com/noahm/DDRCardDraw">GitHub</a>. <a href="#" onClick={showCredits}>Credits.</a>
    </div>
  );
}

function showCredits(e) {
  e.preventDefault();
  alert('App originally by Jeff Lloyd.\
  Weighted distribution code by Chris Chike.\
  Jacket images prepared by FuriousDCSL.\
  Maintained by Noah Manneschmidt.');
}
