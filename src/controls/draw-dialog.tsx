import {
  DialogBody,
  FormGroup,
  Tabs,
  Tab,
  InputGroup,
  TagInput,
  Button,
} from "@blueprintjs/core";
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
    });
  }

  function handleDraw(meta: DrawingMeta["meta"]) {
    if (!configId) {
      return;
    }
    props.onClose();
    dispatch(createDraw({ meta }, configId)).then((result) => {
      props.onDrawAttempt(result === "ok");
    });
  }

  return (
    <DialogBody>
      <FormGroup label="Config">
        <ConfigSelect selectedId={configId} onChange={setConfigId} />
      </FormGroup>
      <Tabs id="new-draw">
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
                <MatchPicker onPickMatch={handleStartggDraw} />
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
                <GauntletPicker onPickMatch={handleStartggDraw} />
              </StartggApiKeyGated>
            }
          >
            start.gg (gauntlet)
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
      <FormGroup label="title">
        <InputGroup
          value={title}
          onChange={(e) => setTitle(e.currentTarget.value)}
        />
      </FormGroup>
      <FormGroup label="players">
        <TagInput
          onChange={(v) => setPlayers(v as string[])}
          values={players}
        />
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
