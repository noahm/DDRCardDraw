import { Button, Input, NativeSelect, Tabs, TextInput } from "@mantine/core";
import { ConfigSelect } from ".";
import { PlayerListInput } from "./player-list-input";
import { MatchPicker, GauntletPicker, PickedMatch } from "../matches";
import { StartggApiKeyGated } from "../startgg-gql/components";
import { piuTourneyEnabled } from "../piu-tourney/config";
import { createDraw } from "../state/thunks";
import { useAppDispatch, useAppState } from "../state/store";
import { eventSlice } from "../state/event.slice";
import { Player, SimpleMeta, newPlayer } from "../models/Drawing";
import { lazy, Suspense, useState } from "react";
import { useAppMode } from "../common-components/app-mode";
import { DrawingMeta } from "../card-draw";
import { useLastConfigSelected } from "../state/config.atoms";
import { useLastCabSelected, useSetLastCabSelected } from "../state/cab.atoms";
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
  const cabs = useAppState(eventSlice.selectors.allCabs);
  const rememberedCab = useLastCabSelected();
  const setRememberedCab = useSetLastCabSelected();
  const showCabPicker = appMode === "event" && !!cabs.length;
  // any client in the room can remove a cab, so a remembered id that no
  // longer resolves falls back to not assigning rather than to a dead select
  const cabId =
    showCabPicker && cabs.some((cab) => cab.id === rememberedCab)
      ? rememberedCab
      : undefined;

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
    void dispatch(createDraw({ meta }, configId, cabId)).then((result) => {
      props.onDrawAttempt(result === "ok");
    });
  }

  return (
    <div>
      <Input.Wrapper label="Config" mb="sm">
        <ConfigSelect selectedId={configId} onChange={setConfigId} />
      </Input.Wrapper>
      {showCabPicker && (
        <NativeSelect
          label="Assign to cab"
          mb="sm"
          value={cabId || ""}
          onChange={(e) => setRememberedCab(e.currentTarget.value || undefined)}
        >
          <option value="">don't assign</option>
          {cabs.map((cab) => (
            <option key={cab.id} value={cab.id}>
              {cab.name}
            </option>
          ))}
        </NativeSelect>
      )}
      {/* keepMounted={false} is what keeps the tourney maker chunk from being
          fetched just for having the dialog on screen */}
      <Tabs defaultValue="custom" keepMounted={false}>
        <Tabs.List mb="sm">
          <Tabs.Tab value="custom">custom draw</Tabs.Tab>
          {appMode === "event" && (
            <Tabs.Tab value="startgg-versus">start.gg (h2h)</Tabs.Tab>
          )}
          {appMode === "event" && (
            <Tabs.Tab value="startgg-group">start.gg (gauntlet)</Tabs.Tab>
          )}
          {appMode === "event" && piuTourneyEnabled && (
            <Tabs.Tab value="piu-tourney">tourney maker</Tabs.Tab>
          )}
        </Tabs.List>
        <Tabs.Panel value="custom">
          <CustomDrawForm disableCreate={!configId} onSubmit={handleDraw} />
        </Tabs.Panel>
        {appMode === "event" && (
          <Tabs.Panel value="startgg-versus">
            <StartggApiKeyGated>
              <MatchPicker onPickMatch={handleExternalDraw} />
            </StartggApiKeyGated>
          </Tabs.Panel>
        )}
        {appMode === "event" && (
          <Tabs.Panel value="startgg-group">
            <StartggApiKeyGated>
              <GauntletPicker onPickMatch={handleExternalDraw} />
            </StartggApiKeyGated>
          </Tabs.Panel>
        )}
        {appMode === "event" && piuTourneyEnabled && (
          <Tabs.Panel value="piu-tourney">
            <Suspense fallback={<DelayedSpinner />}>
              <PiuTourneyTab onPickMatch={handleExternalDraw} />
            </Suspense>
          </Tabs.Panel>
        )}
      </Tabs>
    </div>
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
      <TextInput
        label="title"
        mb="sm"
        value={title}
        onChange={(e) => setTitle(e.currentTarget.value)}
      />
      <Input.Wrapper label="players" mb="sm">
        <PlayerListInput value={players} onChange={setPlayers} />
      </Input.Wrapper>
      <Button onClick={handleSubmit} disabled={props.disableCreate}>
        {props.submitText || "Create"}
      </Button>
    </>
  );
}
