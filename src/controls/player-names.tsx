import { Section, SectionCard } from "@blueprintjs/core";
import { lazy, Suspense, useState } from "react";
import { DelayedSpinner } from "../common-components/delayed-spinner";
// import { useConfigState, useUpdateConfig } from "../state/hooks";
// import { useIntl } from "../hooks/useIntl";
import { useAtomValue } from "jotai";
// import { useAppState } from "../state/store";
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
  // Blueprint renders every tab panel, so this component mounts on app load
  // even when another tab is showing. Keeping the section closed until asked
  // for is what stops that from pulling down the tourney maker chunk.
  const [sourceOpen, setSourceOpen] = useState(false);
  return (
    <>
      <Section
        title="Start.gg Credentials"
        collapsible
        collapseProps={{ defaultIsOpen: !apiKey || !eventSlug }}
        style={{ maxWidth: "50em" }}
      >
        <SectionCard>
          <StartggCredsManager />
        </SectionCard>
      </Section>
      {piuTourneyEnabled && (
        <Section
          title="Tourney Maker Source"
          collapsible
          collapseProps={{
            isOpen: sourceOpen,
            onToggle: () => setSourceOpen((open) => !open),
          }}
          style={{ maxWidth: "50em" }}
        >
          <SectionCard>
            {sourceOpen && (
              <Suspense fallback={<DelayedSpinner />}>
                <PiuTourneyPicker />
              </Suspense>
            )}
          </SectionCard>
        </Section>
      )}
    </>
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

// function EntrantNameForm(props: { entrant: Entrant }) {
//   return (
//     <Label>
//       {props.entrant.startggTag}{" "}
//       <input
//         className={Classes.INPUT}
//         placeholder="Leaderboard name"
//         value={inferShortname(props.entrant.startggTag)}
//       />
//     </Label>
//   );
// }

// function PlayersPerDraw() {
//   const update = useUpdateConfig();
//   const ppd = useConfigState((s) => s.defaultPlayersPerDraw);
//   const { t } = useIntl();

//   return (
//     <FormGroup label={t("controls.playersPerDraw")}>
//       <NumericInput
//         type="number"
//         inputMode="numeric"
//         value={ppd}
//         large
//         min={0}
//         style={{ width: "58px" }}
//         onValueChange={(next) => update({ defaultPlayersPerDraw: next })}
//       />
//     </FormGroup>
//   );
// }
