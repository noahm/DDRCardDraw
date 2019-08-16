import classNames from "classnames";
import styles from "./footer.css";
import globalStyles from "./app.css";

import fbLogo from "ionicons/dist/ionicons/svg/logo-facebook.svg";
import twitterLogo from "ionicons/dist/ionicons/svg/logo-twitter.svg";
import githubLogo from "ionicons/dist/ionicons/svg/logo-github.svg";

function Icon({ src, title }) {
  return (
    <figure
      title={title}
      alt={title}
      dangerouslySetInnerHTML={{ __html: src }}
      className={styles.icon}
    />
  );
}

export function Footer() {
  return (
    <footer className={classNames(styles.footer, globalStyles.padded)}>
      <div>
        Songs up to date as of 8/15/2019.{" "}
        <a href="#" onClick={showCredits}>
          Credits
        </a>
      </div>
      <div>
        <a href="https://m.me/noah.manneschmidt" target="_blank">
          <Icon src={fbLogo} title="Contact me on Facebook Messenger" />
        </a>
        &nbsp;
        <a href="https://twitter.com/Cathadan" target="_blank">
          <Icon src={twitterLogo} title="Contact me on Twitter" />
        </a>
        &nbsp;
        <a href="https://github.com/noahm/DDRCardDraw">
          <Icon src={githubLogo} title="Contribute on Github" />
        </a>
      </div>
    </footer>
  );
}

function showCredits(e) {
  e.preventDefault();
  alert(
    "App originally by Jeff Lloyd.\
Weighted distribution code by Chris Chike.\
Jacket images prepared by FuriousDCSL.\
Maintained by Noah Manneschmidt."
  );
}
