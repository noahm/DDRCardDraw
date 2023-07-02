import { Classes, FormGroup, Icon, Tag } from "@blueprintjs/core";
import { useConfigState } from "../config-state";
import { useIntl } from "../hooks/useIntl";
import { InputButtonPair } from "./input-button-pair";
import { IconNames } from "@blueprintjs/icons";
import { TournamentModeToggle } from "../tournament-mode/tournament-mode-toggle";

export function PlayerNamesControls() {
  const { t } = useIntl();
  const playerNames = useConfigState((s) => s.playerNames);
  const updateConfig = useConfigState((s) => s.update);

  function addPlayer(name: string) {
    if (!playerNames.includes(name)) {
      updateConfig((prev) => {
        const next = prev.playerNames.slice();
        next.push(name);
        return { playerNames: next };
      });
    }
  }
  function removePlayer(name: string) {
    if (playerNames.includes(name)) {
      updateConfig((prev) => {
        return { playerNames: prev.playerNames.filter((n) => n !== name) };
      });
    }
  }

  return (
    <>
      <TournamentModeToggle />
      <FormGroup label={t("controls.addPlayerLabel")}>
        <InputButtonPair
          placeholder={t("controls.newPlayerPlaceholder")}
          buttonLabel={t("add")}
          onClick={(value, input) => {
            addPlayer(value);
            input.value = "";
          }}
        />
      </FormGroup>
      <FormGroup label={t("controls.currentPlayersLabel")}>
        {playerNames.length > 0 ? (
          playerNames.map((player) => (
            <Tag
              icon="person"
              large
              key={player}
              onRemove={() => removePlayer(player)}
              style={{ marginRight: "7px", marginBottom: "7px" }}
            >
              {player}
            </Tag>
          ))
        ) : (
          <span className={Classes.TEXT_DISABLED}>
            <Icon icon={IconNames.HeartBroken} /> {t("controls.noPlayers")}
          </span>
        )}
      </FormGroup>
    </>
  );
}
