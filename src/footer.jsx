import classNames from 'classnames';
import styles from './footer.css';
import globalStyles from './app.css';

export function Footer(props) {
  return (
    <div className={classNames(styles.footer, globalStyles.padded)}>
      By Jeff Lloyd. I'm aware this looks (as is coded) like crap - better version coming soon. Songs up to date as of 03/11/2018. <a href="https://github.com/jefflloyd/DDRCardDraw">View on GitHub</a>
    </div>
  );
}