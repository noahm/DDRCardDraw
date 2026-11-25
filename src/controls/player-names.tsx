import { Accordion } from "@mantine/core";
import { lazy, Suspense, useState } from "react";
import { DelayedSpinner } from "../common-components/delayed-spinner";
import { useAtomValue } from "jotai";
import { startggEventSlug, startggKeyAtom } from "../startgg-gql";
import { StartggCredsManager } from "../startgg-gql/components";
import { piuTourneyEnabled } from "../piu-tourney/config";

// shares the tourney maker chunk with the New Draw dialog's tab, so neither
// pulls @supabase/supabase-js into the main bundle
const PiuTourneyPicker = lazy(() =>
  import("../piu-tourney/components").then((m) => ({
    default: m.PiuTourneyPicker,
  })),
);

export function PlayerNamesControls() {
  const apiKey = useAtomValue(startggKeyAtom);
  const eventSlug = useAtomValue(startggEventSlug);
  // Accordion.Panel keeps its children mounted once rendered, so gate the
  // tourney maker on the section actually being opened rather than let it
  // pull down the supabase chunk for anyone who visits this tab.
  const [openSection, setOpenSection] = useState<string | null>(
    !apiKey || !eventSlug ? "creds" : null,
  );
  return (
    <Accordion
      variant="contained"
      m="md"
      value={openSection}
      onChange={setOpenSection}
      style={{ maxWidth: "50em" }}
    >
      <Accordion.Item value="creds">
        <Accordion.Control>Start.gg Credentials</Accordion.Control>
        <Accordion.Panel>
          <StartggCredsManager />
        </Accordion.Panel>
      </Accordion.Item>
      {piuTourneyEnabled && (
        <Accordion.Item value="tourney-maker">
          <Accordion.Control>Tourney Maker Source</Accordion.Control>
          <Accordion.Panel>
            {openSection === "tourney-maker" && (
              <Suspense fallback={<DelayedSpinner />}>
                <PiuTourneyPicker />
              </Suspense>
            )}
          </Accordion.Panel>
        </Accordion.Item>
      )}
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
