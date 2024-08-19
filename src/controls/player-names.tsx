import { Section, SectionCard } from "@blueprintjs/core";
// import { useConfigState, useUpdateConfig } from "../state/hooks";
// import { useIntl } from "../hooks/useIntl";
import { useAtomValue } from "jotai";
// import { showPlayerAndRoundLabels } from "../config-state";
// import { useAppState } from "../state/store";
import { startggEventSlug, startggKeyAtom } from "../startgg-gql";
import { StartggCredsManager } from "../startgg-gql/components";

export function PlayerNamesControls() {
  const apiKey = useAtomValue(startggKeyAtom);
  const eventSlug = useAtomValue(startggEventSlug);
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
    </>
  );
}

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

// function ShowLabelsToggle() {
//   const [enabled, updateShowLabels] = useAtom(showPlayerAndRoundLabels);
//   const { t } = useIntl();

//   return (
//     <Checkbox
//       checked={enabled}
//       onChange={(e) => updateShowLabels(e.currentTarget.checked)}
//       label={t("controls.playerLabels")}
//     />
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
