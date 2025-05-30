import { FormattedMessage, useIntl } from "react-intl";
import { ButtonGroup, AnchorButton, UL, Classes, H2 } from "@blueprintjs/core";
import { Comment, GitBranch, Chat } from "@blueprintjs/icons";

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
      <H2>
        <FormattedMessage id="about.credits" defaultMessage="Credits" />
      </H2>
      <UL>
        {t({ id: "about.creditsDescription" })
          .split(" * ")
          .map((line, i) => (
            <li key={i}>{injectPumpoutLink(line)}</li>
          ))}
      </UL>
      <H2>
        <FormattedMessage id="about.contribute" defaultMessage="Contribute" />
      </H2>
      <p>{t({ id: "about.contributeDescription" })}</p>
      <div style={{ display: "flex", justifyContent: "center" }}>
        <ButtonGroup>
          <AnchorButton
            large
            href="https://discord.gg/QPyEATsbP7"
            target="_blank"
            text={t({ id: "about.discord" })}
            icon={<Comment size={20} />}
          />
          <AnchorButton
            large
            href="https://github.com/noahm/DDRCardDraw"
            target="_blank"
            text={t({ id: "about.github" })}
            icon={<GitBranch size={20} />}
          />
          <AnchorButton
            large
            href="https://m.me/noah.manneschmidt"
            target="_blank"
            text={t({ id: "about.facebook" })}
            icon={<Chat size={20} />}
          />
        </ButtonGroup>
      </div>
    </div>
  );
}
