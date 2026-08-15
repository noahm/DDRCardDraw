import { ErrorBoundary } from "react-error-boundary";
import { ErrorFallback } from "../utils/error-fallback";
import ControlsDrawer from "./controls-drawer";
import React, { useEffect } from "react";
import { FormattedMessage } from "react-intl";
import { Link, useNavigate, useParams } from "react-router-dom";
import { CircleArrowLeft } from "@blueprintjs/icons";
import { FormGroup, InputGroup } from "@blueprintjs/core";
import { useAppDispatch, useAppState } from "../state/store";
import { configSlice, ConfigState } from "../state/config.slice";
import { GameDataSelect } from "../version-select";
import { useLastConfigSelected } from "../state/config.atoms";
import { changeGameKeyForConfig } from "../state/thunks";
import { ConfigList } from "./config-select";

export function ConfigPage() {
  const navigate = useNavigate();
  // The selected config lives in the path (config/:configId) so it's linkable and
  // survives remounts. All navigation is route-relative: ".." pops the whole
  // config/:configId route back to its parent (classic or /e/:roomName), so the same
  // code works in both modes without knowing which one we're in.
  const { configId: paramConfigId } = useParams<"configId">();
  const configId = paramConfigId || null;

  const lastSelected = useLastConfigSelected() || null;
  const lastSelectedExists = useAppState((s) =>
    lastSelected ? !!configSlice.selectors.selectById(s, lastSelected) : false,
  );
  // On the bare /config route, redirect to the most recently selected config if one
  // still exists, so what's shown always matches the URL.
  useEffect(() => {
    if (!paramConfigId && lastSelected && lastSelectedExists) {
      navigate(`../config/${lastSelected}`, { replace: true });
    }
  }, [paramConfigId, lastSelected, lastSelectedExists, navigate]);

  function setNextConfig(id: string | null) {
    navigate(id ? `../config/${id}` : "../config", { replace: true });
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
          onGameSelect={(newGame) =>
            dispatch(changeGameKeyForConfig(configId, newGame))
          }
        />
      </FormGroup>
    </div>
  );
}
