import { ErrorBoundary } from "react-error-boundary";
import { ErrorFallback } from "../utils/error-fallback";
import ControlsDrawer from "./controls-drawer";
import React, { useState } from "react";
import { FormattedMessage } from "react-intl";
import { ConfigSelect } from ".";
import { Link } from "react-router-dom";
import { CircleArrowLeft } from "@blueprintjs/icons";
import { FormGroup, InputGroup } from "@blueprintjs/core";
import { useAppDispatch, useAppState } from "../state/store";
import { configSlice, ConfigState } from "../state/config.slice";
import { GameDataSelect } from "../version-select";
import { useLastConfigSelected } from "../state/config.atoms";

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
        <ConfigSelect selectedId={configId} onChange={setNextConfig} asList />
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
  const configExists = useAppState((s) =>
    configId ? !!configSlice.selectors.selectById(s, configId) : false,
  );
  if (configExists) {
    return children;
  }
  return null;
}

function ConfigCoreFields({ configId }: { configId: string | null }) {
  const name = useAppState(
    (s) => configId && s.config.entities[configId]?.name,
  );
  const gameKey = useAppState(
    (s) => configId && s.config.entities[configId]?.gameKey,
  );
  const dispatch = useAppDispatch();
  if (!configId) return null;
  const updateConfig = (changes: Partial<ConfigState>) => {
    dispatch(
      configSlice.actions.updateOne({
        id: configId,
        changes,
      }),
    );
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
          onGameSelect={(newGame) => updateConfig({ gameKey: newGame })}
        />
      </FormGroup>
    </div>
  );
}
