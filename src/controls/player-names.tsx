import {
  Checkbox,
  Classes,
  FormGroup,
  Label,
  Text,
  NumericInput,
  TagInput,
} from "@blueprintjs/core";
import React, { useCallback } from "react";
import { useConfigState, useUpdateConfig } from "../state/hooks";
import { useIntl } from "../hooks/useIntl";
import { atom, useAtom } from "jotai";
import { showPlayerAndRoundLabels } from "../config-state";
import { useAppDispatch, useAppState } from "../state/store";
import { entrantsSlice, Entrant } from "../state/entrants.slice";
import { getEventEntrants } from "../startgg-gql";
import { Person } from "@blueprintjs/icons";

export function PlayerNamesControls() {
  const updateConfig = useUpdateConfig();
  const playerNames = useConfigState((s) => s.playerNames);
  const { t } = useIntl();

  function addPlayers(names: string[]) {
    updateConfig((prev) => {
      const next = prev.playerNames.slice();
      for (const name of names) {
        if (!next.includes(name)) {
          next.push(name);
        }
      }
      if (next.length !== prev.playerNames.length) {
        return { playerNames: next };
      }
      return {};
    });
  }
  function removePlayer(name: React.ReactNode, index: number) {
    updateConfig((prev) => {
      const next = prev.playerNames.slice();
      next.splice(index, 1);
      return { playerNames: next };
    });
  }

  return (
    <>
      <ShowLabelsToggle />
      <PlayersPerDraw />
      <FormGroup label={t("controls.addPlayerLabel")}>
        <TagInput
          values={playerNames}
          fill
          large
          leftIcon={<Person size={20} className={Classes.TAG_INPUT_ICON} />}
          onAdd={addPlayers}
          onRemove={removePlayer}
        />
      </FormGroup>
    </>
  );
}

export const startggKeyAtom = atom<string | null>(
  process.env.STARTGG_TOKEN as string,
);
export const startggEventSlug = atom<string | null>(
  "tournament/red-october-2024/event/stepmaniax-singles-hard-and-wild",
);

export function StartggEntrantManager() {
  const { t } = useIntl();
  const entrants = useAppState(entrantsSlice.selectors.selectAll);
  if (!entrants.length) {
    return <StartggEntrantImport />;
  }
  return (
    <FormGroup label={t("controls.addPlayerLabel")}>
      {entrants.map((e) => (
        <EntrantNameForm key={e.id} entrant={e} />
      ))}
    </FormGroup>
  );
}

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
