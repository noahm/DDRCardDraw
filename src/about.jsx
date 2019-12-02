import { Modal } from "./modal";
import { useContext } from "preact/hooks";
import { TranslateContext } from "@denysvuika/preact-translate";
import { Icon } from "./icon";
import styles from "./about.css";

import fbLogo from "ionicons/dist/ionicons/svg/logo-facebook.svg";
import twitterLogo from "ionicons/dist/ionicons/svg/logo-twitter.svg";
import githubLogo from "ionicons/dist/ionicons/svg/logo-github.svg";

export function About({ onClose }) {
  const { t } = useContext(TranslateContext);

  return (
    <Modal onClose={onClose}>
      <div className={styles.about}>
        <p>
          <ul>
            {t("about")
              .split(" * ")
              .map((line, i) => (
                <li key={i}>{line}</li>
              ))}
          </ul>
        </p>
        <p>
          {t("contact.prompt")}
          <ul className={styles.icons}>
            <li>
              <a href="https://m.me/noah.manneschmidt" target="_blank">
                <Icon src={fbLogo} title={t("contact.facebook")} />
              </a>
            </li>
            <li>
              <a href="https://twitter.com/Cathadan" target="_blank">
                <Icon src={twitterLogo} title={t("contact.twitter")} />
              </a>
            </li>
            <li>
              <a href="https://github.com/noahm/DDRCardDraw">
                <Icon src={githubLogo} title={t("contact.github")} />
              </a>
            </li>
          </ul>
        </p>
      </div>
    </Modal>
  );
}
