import { Accordion } from "@mantine/core";
import { useAtomValue } from "jotai";
import { startggEventSlug, startggKeyAtom } from "../startgg-gql";
import { StartggCredsManager } from "../startgg-gql/components";

export function PlayerNamesControls() {
  const apiKey = useAtomValue(startggKeyAtom);
  const eventSlug = useAtomValue(startggEventSlug);
  return (
    <Accordion
      variant="contained"
      m="md"
      defaultValue={!apiKey || !eventSlug ? "creds" : null}
      style={{ maxWidth: "50em" }}
    >
      <Accordion.Item value="creds">
        <Accordion.Control>Start.gg Credentials</Accordion.Control>
        <Accordion.Panel>
          <StartggCredsManager />
        </Accordion.Panel>
      </Accordion.Item>
    </Accordion>
  );
}

export function inferShortname(name: string): string;
export function inferShortname(
  name: string | null | undefined,
): string | undefined;
export function inferShortname(name: string | null | undefined) {
  if (!name) return;
  const namePieces = name.split(" | ");
  return namePieces.length >= 1 ? namePieces[namePieces.length - 1] : undefined;
}
