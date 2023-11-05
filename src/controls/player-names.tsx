import { Checkbox, FormGroup, NumericInput, TagInput } from "@blueprintjs/core";
import { ReactNode } from "react";
import { useConfigState } from "../config-state";
import { useIntl } from "../hooks/useIntl";

export function PlayerNamesControls() {
  const { t } = useIntl();
  const playerNames = useConfigState((s) => s.playerNames);
  const updateConfig = useConfigState((s) => s.update);

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
  function removePlayer(name: ReactNode, index: number) {
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
          leftIcon="person"
          onAdd={addPlayers}
          onRemove={removePlayer}
        />
      </FormGroup>
      <TournamentLabelEditor />
    </>
  );
}

function ShowLabelsToggle() {
  const update = useConfigState((s) => s.update);
  const enabled = useConfigState((s) => s.showPlayerAndRoundLabels);
  const { t } = useIntl();

  return (
    <Checkbox
      checked={enabled}
      onChange={(e) =>
        update({ showPlayerAndRoundLabels: e.currentTarget.checked })
      }
      label={t("controls.playerLabels")}
    />
  );
}

function PlayersPerDraw() {
  const update = useConfigState((s) => s.update);
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

function TournamentLabelEditor() {
  const { t } = useIntl();
  const tournamentRounds = useConfigState((s) => s.tournamentRounds);
  const updateConfig = useConfigState((s) => s.update);

  function addLabels(names: string[]) {
    updateConfig((prev) => {
      const next = prev.tournamentRounds.slice();
      for (const name of names) {
        if (!next.includes(name)) {
          next.push(name);
        }
      }
      if (next.length !== prev.tournamentRounds.length) {
        return { tournamentRounds: next };
      }
      return {};
    });
  }
  function removeLabel(name: ReactNode, index: number) {
    updateConfig((prev) => {
      const next = prev.tournamentRounds.slice();
      next.splice(index, 1);
      return { tournamentRounds: next };
    });
  }
  return (
    <FormGroup label={t("controls.tournamentLabelEdit")}>
      <TagInput
        values={tournamentRounds}
        fill
        large
        leftIcon="diagram-tree"
        onAdd={addLabels}
        onRemove={removeLabel}
      />
    </FormGroup>
  );
}
