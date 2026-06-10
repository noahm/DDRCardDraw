import { Button, Input, Tabs, TagsInput, TextInput } from "@mantine/core";
import { ConfigSelect } from ".";
import { MatchPicker, GauntletPicker, PickedMatch } from "../matches";
import { StartggApiKeyGated } from "../startgg-gql/components";
import { createDraw } from "../state/thunks";
import { useAppDispatch } from "../state/store";
import { SimpleMeta } from "../models/Drawing";
import { useState } from "react";
import { useAppMode } from "../common-components/app-mode";
import { DrawingMeta } from "../card-draw";
import { useLastConfigSelected } from "../state/config.atoms";

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

  function handleStartggDraw(match: PickedMatch) {
    return handleDraw({
      type: "startgg",
      subtype: match.subtype,
      entrants: match.players,
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
    <div>
      <Input.Wrapper label="Config" mb="sm">
        <ConfigSelect selectedId={configId} onChange={setConfigId} />
      </Input.Wrapper>
      <Tabs defaultValue="custom">
        <Tabs.List mb="sm">
          <Tabs.Tab value="custom">custom draw</Tabs.Tab>
          {appMode === "event" && (
            <Tabs.Tab value="startgg-versus">start.gg (h2h)</Tabs.Tab>
          )}
          {appMode === "event" && (
            <Tabs.Tab value="startgg-group">start.gg (gauntlet)</Tabs.Tab>
          )}
        </Tabs.List>
        <Tabs.Panel value="custom">
          <CustomDrawForm disableCreate={!configId} onSubmit={handleDraw} />
        </Tabs.Panel>
        {appMode === "event" && (
          <Tabs.Panel value="startgg-versus">
            <StartggApiKeyGated>
              <MatchPicker onPickMatch={handleStartggDraw} />
            </StartggApiKeyGated>
          </Tabs.Panel>
        )}
        {appMode === "event" && (
          <Tabs.Panel value="startgg-group">
            <StartggApiKeyGated>
              <GauntletPicker onPickMatch={handleStartggDraw} />
            </StartggApiKeyGated>
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
  const [players, setPlayers] = useState<string[]>(
    props.initialMeta?.players || ["P1", "P2"],
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
      <TagsInput
        label="players"
        mb="sm"
        onChange={setPlayers}
        value={players}
      />
      <Button onClick={handleSubmit} disabled={props.disableCreate}>
        {props.submitText || "Create"}
      </Button>
    </>
  );
}
