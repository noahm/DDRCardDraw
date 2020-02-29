import classNames from "classnames";
import { detectedLanguage } from "./utils";
import styles from "./footer.css";
import globalStyles from "./app.css";
import { AuthButton } from "./auth-button";
import { useContext, useState } from "preact/hooks";
import { TranslateContext } from "@denysvuika/preact-translate";
import { About } from "./about";
import { Link } from "wouter-preact";

// note that month is zero-indexed for date constructor :)
const lastUpdate = new Date(2020, 1, 20);

export function Footer() {
  const { t } = useContext(TranslateContext);
  const [showAbout, updateShowAbout] = useState(false);

  return (
    <footer className={classNames(styles.footer, globalStyles.padded)}>
      {showAbout && <About onClose={() => updateShowAbout(false)} />}
      <div>
        {t("lastUpdate", {
          date: new Intl.DateTimeFormat(detectedLanguage).format(lastUpdate)
        })}
      </div>
      <div className={styles.icons}>
        {/* <AuthButton />{" "} */}
        <Link href="/a20/songs">Songs</Link>{" "}
        <a href="#" onClick={e => (e.preventDefault(), updateShowAbout(true))}>
          {t("credits")}
        </a>
      </div>
    </footer>
  );
}
