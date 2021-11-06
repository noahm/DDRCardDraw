import classNames from "classnames";

import { detectedLanguage } from "./utils";
import styles from "./footer.css";
import globalStyles from "./app.css";
import { useState } from "react";
import { About } from "./about";
import { useIntl } from "./hooks/useIntl";

// note that month is zero-indexed for date constructor :)
const lastUpdate = new Date(2021, 9, 23);

export function Footer() {
  const { t } = useIntl();
  const [showAbout, updateShowAbout] = useState(false);

  return (
    <footer className={classNames(styles.footer, globalStyles.padded)}>
      {showAbout && <About onClose={() => updateShowAbout(false)} />}
      <div>
        {t("lastUpdate", {
          date: new Intl.DateTimeFormat(detectedLanguage).format(lastUpdate),
        })}
      </div>
      <div className={styles.icons}>
        {/* <AuthButton />{" "} */}
        <a
          href="#"
          onClick={(e) => (e.preventDefault(), updateShowAbout(true))}
        >
          {t("credits")}
        </a>
      </div>
    </footer>
  );
}
