import {
  DialogBody,
  FormGroup,
  Tabs,
  Tab,
  InputGroup,
  Button,
} from "@blueprintjs/core";
import { ConfigSelect } from ".";
import { PlayerListInput } from "./player-list-input";
import { MatchPicker, GauntletPicker, PickedMatch } from "../matches";
import { StartggApiKeyGated } from "../startgg-gql/components";
import { piuTourneyEnabled } from "../piu-tourney/config";
import { createDraw } from "../state/thunks";
import { useAppDispatch } from "../state/store";
import { Player, SimpleMeta, newPlayer } from "../models/Drawing";
import { lazy, Suspense, useState } from "react";
import { useAppMode } from "../common-components/app-mode";
import { DrawingMeta } from "../card-draw";
import { useLastConfigSelected } from "../state/config.atoms";
import { DelayedSpinner } from "../common-components/delayed-spinner";

// keeps @supabase/supabase-js and the tourney maker UI out of the main bundle;
// the chunk is fetched the first time this tab is opened
const PiuTourneyTab = lazy(() => import("../piu-tourney/tab"));

interface Props {
  onClose(): void;
  onDrawAttempt(wasSuccess: boolean): void;
}

export function DrawDialog(props: Props) {
  const [configId, setConfigId] = useState<string | null>(
    useLastConfigSelected() || null,
  );
  const dispatch = useAppDispatch();
  const appMode = useAppMode();
  const [selectedTab, setSelectedTab] = useState<string | number>("custom");

  function handleExternalDraw(match: PickedMatch) {
    if (match.provider === "piu") {
      return handleDraw({
        type: "piu",
        subtype: match.subtype,
        players: match.players,
        title: match.title,
        id: match.id,
        phaseName: match.phaseName,
        tourneyId: match.tourneyId!,
      });
    }
    return handleDraw({
      type: "startgg",
      subtype: match.subtype,
      players: match.players,
      title: match.title,
      id: match.id,
      phaseName: match.phaseName,
    });
  }

  function handleDraw(meta: DrawingMeta["meta"]) {
    if (!configId) {
      return;
    }
    props.onClose();
    void dispatch(createDraw({ meta }, configId)).then((result) => {
      props.onDrawAttempt(result === "ok");
    });
  }

  return (
    <DialogBody>
      <FormGroup label="Config">
        <ConfigSelect selectedId={configId} onChange={setConfigId} />
      </FormGroup>
      <Tabs
        id="new-draw"
        selectedTabId={selectedTab}
        onChange={(next) => setSelectedTab(next)}
      >
        <Tab
          id="custom"
          panel={
            <CustomDrawForm disableCreate={!configId} onSubmit={handleDraw} />
          }
        >
          custom draw
        </Tab>
        {appMode === "event" && (
          <Tab
            id="startgg-versus"
            panel={
              <StartggApiKeyGated>
                <MatchPicker onPickMatch={handleExternalDraw} />
              </StartggApiKeyGated>
            }
          >
            start.gg (h2h)
          </Tab>
        )}
        {appMode === "event" && (
          <Tab
            id="startgg-group"
            panel={
              <StartggApiKeyGated>
                <GauntletPicker onPickMatch={handleExternalDraw} />
              </StartggApiKeyGated>
            }
          >
            start.gg (gauntlet)
          </Tab>
        )}
        {appMode === "event" && piuTourneyEnabled && (
          <Tab
            id="piu-tourney"
            panel={
              // only reached once the tab is opened, so the chunk isn't
              // fetched just for having the dialog on screen
              selectedTab === "piu-tourney" ? (
                <Suspense fallback={<DelayedSpinner />}>
                  <PiuTourneyTab onPickMatch={handleExternalDraw} />
                </Suspense>
              ) : undefined
            }
          >
            tourney maker
          </Tab>
        )}
      </Tabs>
    </DialogBody>
  );
}

export function CustomDrawForm(props: {
  initialMeta?: SimpleMeta;
  disableCreate?: boolean;
  submitText?: string;
  onSubmit(meta: SimpleMeta): void;
}) {
  // meta.players is already in display order
  const [players, setPlayers] = useState<Player[]>(
    () => props.initialMeta?.players ?? [newPlayer("P1"), newPlayer("P2")],
  );
  const [title, setTitle] = useState<string>(props.initialMeta?.title || "");

  function handleSubmit() {
    props.onSubmit({
      type: "simple",
      players,
      title,
    });
  }
  return (
    <>
      <FormGroup label="title">
        <InputGroup
          value={title}
          onChange={(e) => setTitle(e.currentTarget.value)}
        />
      </FormGroup>
      <FormGroup label="players">
        <PlayerListInput value={players} onChange={setPlayers} />
      </FormGroup>
      <Button
        intent="primary"
        onClick={handleSubmit}
        disabled={props.disableCreate}
      >
        {props.submitText || "Create"}
      </Button>
    </>
  );
}
