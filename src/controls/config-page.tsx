import { ErrorBoundary } from "react-error-boundary";
import { ErrorFallback } from "../utils/error-fallback";
import ControlsDrawer from "./controls-drawer";
import React, { useState } from "react";
import { FormattedMessage } from "react-intl";
import { Link } from "react-router-dom";
import { CircleArrowLeft } from "@blueprintjs/icons";
import { FormGroup, InputGroup } from "@blueprintjs/core";
import { useRoomState } from "../jazz/app-state-context";
import { useMutations } from "../jazz/use-mutations";
import type { ConfigState } from "../state/config.slice";
import { GameDataSelect } from "../version-select";
import { useLastConfigSelected } from "../state/config.atoms";
import { ConfigList } from "./config-select";

export function ConfigPage() {
  const initialState = useLastConfigSelected() || null;
  const [configId, setConfigId] = useState<string | null>(initialState);
  function setNextConfig(id: string | null) {
    setConfigId(id);
  }

  return (
    <div style={{ paddingInline: "1em" }}>
      <h1>
        <Link to="..">
          <CircleArrowLeft size={20} style={{ verticalAlign: "middle" }} />
        </Link>{" "}
        <FormattedMessage id="controls.drawerTitle" />
      </h1>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 5fr" }}>
        <ConfigList selectedId={configId} onChange={setNextConfig} />
        <ConfigIdGate configId={configId}>
          <div style={{ maxWidth: "30em" }}>
            <ConfigCoreFields configId={configId} />
            <ErrorBoundary fallback={<ErrorFallback />}>
              <ControlsDrawer configId={configId} />
            </ErrorBoundary>
          </div>
        </ConfigIdGate>
      </div>
    </div>
  );
}

function ConfigIdGate({
  configId,
  children,
}: {
  configId: string | null;
  children: React.ReactNode;
}) {
  const configExists = useRoomState((s) =>
    configId ? !!s.config.entities[configId] : false,
  );
  if (configExists) {
    return children;
  }
  return null;
}

function ConfigCoreFields({ configId }: { configId: string | null }) {
  const name = useRoomState(
    (s) => configId && s.config.entities[configId]?.name,
  );
  const gameKey = useRoomState(
    (s) => configId && s.config.entities[configId]?.gameKey,
  );
  const mutations = useMutations();
  if (!configId) return null;
  const updateConfig = (changes: Partial<ConfigState>) => {
    mutations.updateConfig(configId, changes);
  };
  return (
    <div style={{ paddingInline: "1.5em" }}>
      <FormGroup label="Name">
        <InputGroup
          value={name || ""}
          onChange={(e) => updateConfig({ name: e.currentTarget.value })}
        />
      </FormGroup>
      <FormGroup label="Game Data">
        <GameDataSelect
          fill
          value={gameKey || undefined}
          onGameSelect={(newGame) =>
            mutations.changeGameKey(configId, newGame)
          }
        />
      </FormGroup>
    </div>
  );
}
