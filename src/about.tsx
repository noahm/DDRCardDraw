import { Modal } from "./modal";
import { FunctionComponent } from "preact";
import { useContext } from "preact/hooks";
import { TranslateContext } from "@denysvuika/preact-translate";
import { Icon } from "./icon";
import styles from "./about.css";

import { Github, Facebook, Twitter } from "preact-feather";

interface Props {
  onClose: () => void;
}

export const About: FunctionComponent<Props> = ({ onClose }) => {
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
                <Icon
                  svg={<Facebook size={48} />}
                  title={t("contact.facebook")}
                />
              </a>
            </li>
            <li>
              <a href="https://twitter.com/Cathadan" target="_blank">
                <Icon
                  svg={<Twitter size={48} />}
                  title={t("contact.twitter")}
                />
              </a>
            </li>
            <li>
              <a href="https://github.com/noahm/DDRCardDraw">
                <Icon svg={<Github size={48} />} title={t("contact.github")} />
              </a>
            </li>
          </ul>
        </p>
      </div>
    </Modal>
  );
};
