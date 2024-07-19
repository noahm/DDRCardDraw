import {
  Checkbox,
  Classes,
  FormGroup,
  Label,
  Text,
  NumericInput,
} from "@blueprintjs/core";
import React, { useCallback } from "react";
import { useConfigState, useUpdateConfig } from "../state/hooks";
import { useIntl } from "../hooks/useIntl";
import { atom, useAtom } from "jotai";
import { showPlayerAndRoundLabels } from "../config-state";
import { useAppDispatch, useAppState } from "../state/store";
import { entrantsSlice, Entrant } from "../state/entrants.slice";
import { getEventEntrants } from "../startgg-gql";

export function PlayerNamesControls() {
  const { t } = useIntl();
  const entrants = useAppState(entrantsSlice.selectors.selectAll);

  return (
    <>
      <ShowLabelsToggle />
      <PlayersPerDraw />
      {entrants.length ? (
        <FormGroup label={t("controls.addPlayerLabel")}>
          {entrants.map((e) => (
            <EntrantNameForm key={e.id} entrant={e} />
          ))}
        </FormGroup>
      ) : (
        <StartggEntrantImport />
      )}
    </>
  );
}

export const startggKeyAtom = atom<string | null>(
  process.env.STARTGG_TOKEN as string,
);
export const startggEventSlug = atom<string | null>(null);

function StartggEntrantImport() {
  const [apiKey, setApiKey] = useAtom(startggKeyAtom);
  const [eventSlug, setEventSlug] = useAtom(startggEventSlug);
  const dispatch = useAppDispatch();
  const importEntrants = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!apiKey || !eventSlug) {
        return;
      }
      const entrants = await getEventEntrants(apiKey, eventSlug);
      dispatch(entrantsSlice.actions.upsertMany(entrants));
    },
    [dispatch, apiKey, eventSlug],
  );
  return (
    <form onSubmit={importEntrants}>
      <Text tagName="p">No players added yet, import from start.gg</Text>
      <Label>
        start.gg api key{" "}
        <input
          value={apiKey || ""}
          onChange={(e) => setApiKey(e.currentTarget.value)}
          className={Classes.INPUT}
        />
      </Label>
      <Label>
        event url
        <input
          value={eventSlug || ""}
          onChange={(e) => setEventSlug(e.currentTarget.value)}
          className={Classes.INPUT}
        />
      </Label>
      <button type="submit">Import Players</button>
    </form>
  );
}

function inferShortname(name: string) {
  const namePieces = name.split(" | ");
  return namePieces.length > 1 ? namePieces[namePieces.length - 1] : undefined;
}

function EntrantNameForm(props: { entrant: Entrant }) {
  return (
    <Label>
      {props.entrant.startggTag}{" "}
      <input
        className={Classes.INPUT}
        placeholder="Leaderboard name"
        value={inferShortname(props.entrant.startggTag)}
      />
    </Label>
  );
}

function ShowLabelsToggle() {
  const [enabled, updateShowLabels] = useAtom(showPlayerAndRoundLabels);
  const { t } = useIntl();

  return (
    <Checkbox
      checked={enabled}
      onChange={(e) => updateShowLabels(e.currentTarget.checked)}
      label={t("controls.playerLabels")}
    />
  );
}

function PlayersPerDraw() {
  const update = useUpdateConfig();
  const ppd = useConfigState((s) => s.defaultPlayersPerDraw);
  const { t } = useIntl();

  return (
    <FormGroup label={t("controls.playersPerDraw")}>
      <NumericInput
        type="number"
        inputMode="numeric"
        value={ppd}
        large
        min={0}
        style={{ width: "58px" }}
        onValueChange={(next) => update({ defaultPlayersPerDraw: next })}
      />
    </FormGroup>
  );
}
