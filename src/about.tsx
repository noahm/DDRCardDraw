import { FormattedMessage, useIntl } from "react-intl";
import { Button, List, Title } from "@mantine/core";
import {
  IconMessage,
  IconGitBranch,
  IconMessageCircle,
} from "@tabler/icons-react";

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
    <div>
      <Title order={2}>
        <FormattedMessage id="about.credits" defaultMessage="Credits" />
      </Title>
      <List my="sm">
        {t({ id: "about.creditsDescription" })
          .split(" * ")
          .map((line, i) => (
            <List.Item key={i}>{injectPumpoutLink(line)}</List.Item>
          ))}
      </List>
      <Title order={2}>
        <FormattedMessage id="about.contribute" defaultMessage="Contribute" />
      </Title>
      <p>{t({ id: "about.contributeDescription" })}</p>
      <div style={{ display: "flex", justifyContent: "center" }}>
        <Button.Group>
          <Button
            size="md"
            variant="default"
            component="a"
            href="https://discord.gg/QPyEATsbP7"
            target="_blank"
            leftSection={<IconMessage size={20} />}
          >
            {t({ id: "about.discord" })}
          </Button>
          <Button
            size="md"
            variant="default"
            component="a"
            href="https://github.com/noahm/DDRCardDraw"
            target="_blank"
            leftSection={<IconGitBranch size={20} />}
          >
            {t({ id: "about.github" })}
          </Button>
          <Button
            size="md"
            variant="default"
            component="a"
            href="https://m.me/noah.manneschmidt"
            target="_blank"
            leftSection={<IconMessageCircle size={20} />}
          >
            {t({ id: "about.facebook" })}
          </Button>
        </Button.Group>
      </div>
    </div>
  );
}
