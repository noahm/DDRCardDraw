import { Modal } from "./modal";
import { FunctionComponent } from "react";
import { useIntl } from "react-intl";
import { Icon } from "./icon";
import styles from "./about.css";

import { GitHub, Facebook, Twitter } from "react-feather";

interface Props {
  onClose: () => void;
}

export const About: FunctionComponent<Props> = ({ onClose }) => {
  const { formatMessage: t } = useIntl();

  return (
    <Modal onClose={onClose}>
      <div className={styles.about}>
        <ul>
          {t({ id: "about" })
            .split(" * ")
            .map((line, i) => (
              <li key={i}>{line}</li>
            ))}
        </ul>
        <p>{t({ id: "contact.prompt" })}</p>
        <ul className={styles.icons}>
          <li>
            <a href="https://m.me/noah.manneschmidt" target="_blank">
              <Icon
                svg={<Facebook size={48} />}
                title={t({ id: "contact.facebook" })}
              />
            </a>
          </li>
          <li>
            <a href="https://twitter.com/Cathadan" target="_blank">
              <Icon
                svg={<Twitter size={48} />}
                title={t({ id: "contact.twitter" })}
              />
            </a>
          </li>
          <li>
            <a href="https://github.com/noahm/DDRCardDraw">
              <Icon
                svg={<GitHub size={48} />}
                title={t({ id: "contact.github" })}
              />
            </a>
          </li>
        </ul>
      </div>
    </Modal>
  );
};
