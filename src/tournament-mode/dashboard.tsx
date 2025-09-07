import {
  AnchorButton,
  Button,
  ButtonGroup,
  Card,
  CardList,
  Dialog,
  DialogBody,
  DialogFooter,
  FormGroup,
  H3,
  H4,
  InputGroup,
} from "@blueprintjs/core";
import { useAppDispatch, useAppState } from "../state/store";
import { Add, Duplicate, Edit } from "@blueprintjs/icons";
import React, { useRef, useState } from "react";
import { eventSlice } from "../state/event.slice";
import { nanoid } from "nanoid";
import { copyObsSource, routableGlobalSourcePath } from "./copy-obs-source";

import styles from "./dashboard.css";
import { useInObs } from "../theme-toggle";
import { useHref } from "react-router-dom";

export function Dashboard() {
  const [currentEdit, setCurrentEdit] = useState<string | null>(null);
  const labels = useAppState((s) => s.event.obsLabels);
  const isObs = useInObs();

  return (
    <>
      <div style={{ padding: "1rem" }}>
        {!isObs && (
          <p>
            <em>
              <b>HINT:</b> add this page as a custom browser dock in OBS!
            </em>
          </p>
        )}
        <section style={{ maxWidth: "600px" }}>
          <EditDialog
            sourceId={currentEdit}
            close={() => setCurrentEdit(null)}
          />
          <H3>
            OBS Text Sources{" "}
            <Button
              icon={<Add />}
              onClick={() => setCurrentEdit(nanoid())}
            ></Button>
          </H3>
          <CardList>
            {Object.entries(labels).map(([id, { label, value }]) => (
              <LabelCard
                key={id}
                id={id}
                label={label}
                value={value}
                onEdit={() => setCurrentEdit(id)}
              />
            ))}
          </CardList>
        </section>
      </div>
    </>
  );
}

function LabelCard(props: {
  id: string;
  label: string;
  value: string;
  onEdit(): void;
}) {
  const href = useHref(routableGlobalSourcePath(props.id));
  return (
    <Card className={styles.textSourceCard}>
      <div>
        <p>{props.label}</p>
        <H4>{props.value}</H4>
      </div>
      <ButtonGroup>
        <Button icon={<Edit />} onClick={props.onEdit} />
        <AnchorButton
          icon={<Duplicate />}
          onClick={(e) => {
            e.preventDefault();
            copyObsSource(href);
          }}
          href={href}
        />
      </ButtonGroup>
    </Card>
  );
}

function EditDialog({
  sourceId,
  close,
}: {
  sourceId: string | null;
  close(): void;
}) {
  const label = useAppState((s) =>
    sourceId ? s.event.obsLabels[sourceId] : null,
  ) || { label: "", value: "" };
  const dispatch = useAppDispatch();
  const nameInput = useRef<HTMLInputElement>(null);
  const valueInput = useRef<HTMLInputElement>(null);
  if (!label || !sourceId) {
    return null;
  }
  const submit = () => {
    dispatch(
      eventSlice.actions.updateLabel({
        id: sourceId,
        label: nameInput.current?.value || "",
        value: valueInput.current?.value || "",
      }),
    );
    close();
  };
  const handleInputKeydown: React.KeyboardEventHandler<HTMLInputElement> = (
    e,
  ) => {
    if (
      e.key === "Enter" &&
      !e.altKey &&
      !e.ctrlKey &&
      !e.shiftKey &&
      !e.metaKey
    ) {
      submit();
    }
  };
  return (
    <Dialog isOpen={!!sourceId} title="Edit Custom OBS label" onClose={close}>
      <DialogBody>
        <form action={submit}>
          <FormGroup label="Label Name">
            <InputGroup
              inputRef={nameInput}
              defaultValue={label.label}
              onKeyDown={handleInputKeydown}
            />
          </FormGroup>
          <FormGroup label="Value">
            <InputGroup
              inputRef={valueInput}
              defaultValue={label.value}
              onKeyDown={handleInputKeydown}
            />
          </FormGroup>
        </form>
      </DialogBody>
      <DialogFooter
        actions={
          <>
            <Button onClick={close}>Cancel</Button>
            <Button intent="primary" onClick={submit}>
              Save
            </Button>
          </>
        }
      />
    </Dialog>
  );
}
