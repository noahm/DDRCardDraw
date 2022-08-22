import { useIntl } from "react-intl";
import { ButtonGroup, AnchorButton, UL, Classes } from "@blueprintjs/core";
import { IconNames } from "@blueprintjs/icons";

function injectPumpoutLink(str: string) {
  const pieces = str.split("PUMPOUT");
  if (pieces.length < 2) {
    return str;
  }
  return (
    <>
      {pieces[0]}
      <a href="https://github.com/AnyhowStep/pump-out-sqlite3-dump">Pump Out</a>
      {pieces[1]}
    </>
  );
}

export function About() {
  const { formatMessage: t } = useIntl();

  return (
    <div className={Classes.DIALOG_BODY}>
      <UL>
        {t({ id: "about" })
          .split(" * ")
          .map((line, i) => (
            <li key={i}>{injectPumpoutLink(line)}</li>
          ))}
      </UL>
      <p>{t({ id: "contact.prompt" })}</p>
      <ButtonGroup vertical>
        <AnchorButton
          href="https://m.me/noah.manneschmidt"
          target="_blank"
          text={t({ id: "contact.facebook" })}
          rightIcon={IconNames.SHARE}
        />
        <AnchorButton
          href="https://twitter.com/Cathadan"
          target="_blank"
          text={t({ id: "contact.twitter" })}
          rightIcon={IconNames.SHARE}
        />
        <AnchorButton
          href="https://github.com/noahm/DDRCardDraw"
          target="_blank"
          text={t({ id: "contact.github" })}
          rightIcon={IconNames.SHARE}
        />
      </ButtonGroup>
    </div>
  );
}
