import classNames from "classnames";
import { Localizer, Text } from "preact-i18n";

import { detectedLanguage } from "./utils";
import styles from "./footer.css";
import globalStyles from "./app.css";

import fbLogo from "ionicons/dist/ionicons/svg/logo-facebook.svg";
import twitterLogo from "ionicons/dist/ionicons/svg/logo-twitter.svg";
import githubLogo from "ionicons/dist/ionicons/svg/logo-github.svg";
import { AuthButton } from "./auth-button";
import { Icon } from "./icon";

const lastUpdate = new Intl.DateTimeFormat(detectedLanguage).format(
  // note that month is zero-indexed for date constructor :)
  new Date(2019, 9, 22)
);

export function Footer() {
  return (
    <footer className={classNames(styles.footer, globalStyles.padded)}>
      <div>
        <Text id="lastUpdate" fields={{ date: lastUpdate }}>
          {`Songs up to date as of ${lastUpdate}.`}
        </Text>{" "}
        <a href="#" onClick={showCredits}>
          <Text id="credits">Credits</Text>
        </a>
      </div>
      <div>
        {/* <AuthButton /> */}
        &nbsp;
        <a href="https://m.me/noah.manneschmidt" target="_blank">
          <Localizer>
            <Icon src={fbLogo} title={<Text id="contact.facebook" />} />
          </Localizer>
        </a>
        &nbsp;
        <a href="https://twitter.com/Cathadan" target="_blank">
          <Localizer>
            <Icon src={twitterLogo} title={<Text id="contact.twitter" />} />
          </Localizer>
        </a>
        &nbsp;
        <a href="https://github.com/noahm/DDRCardDraw">
          <Localizer>
            <Icon src={githubLogo} title={<Text id="contact.github" />} />
          </Localizer>
        </a>
      </div>
    </footer>
  );
}

function showCredits(e) {
  e.preventDefault();
  alert(
    "App originally by Jeff Lloyd. \
Weighted distribution code by Chris Chike. \
Jacket images prepared by FuriousDCSL. \
Japanese localization by nalpan. \
Maintained by Noah Manneschmidt."
  );
}
