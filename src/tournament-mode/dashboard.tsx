import {
  ActionIcon,
  Button,
  Card,
  Group,
  Modal,
  Stack,
  TextInput,
  Title,
} from "@mantine/core";
import { useAppDispatch, useAppState } from "../state/store";
import {
  IconPlus,
  IconCopy,
  IconEdit,
  IconDeviceFloppy,
} from "@tabler/icons-react";
import React, { useRef, useState } from "react";
import { eventSlice } from "../state/event.slice";
import { nanoid } from "nanoid";
import { copyObsSource, routableGlobalSourcePath } from "./copy-obs-source";

import styles from "./dashboard.css";
import { useInObs, useTheme } from "../theme-toggle";
import { useHref } from "react-router-dom";
import ReactCodeMirror from "@uiw/react-codemirror";

export function Dashboard() {
  const [currentEdit, setCurrentEdit] = useState<string | null>(null);
  const labels = useAppState((s) => s.event.obsLabels);
  const isObs = useInObs();

  return (
    <>
      <div className={styles.container}>
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
          <Title order={3} mb="xs">
            OBS Text Sources{" "}
            <ActionIcon
              variant="default"
              aria-label="Add OBS text source"
              onClick={() => setCurrentEdit(nanoid())}
            >
              <IconPlus size={16} />
            </ActionIcon>
          </Title>
          <Stack gap="xs">
            {Object.entries(labels).map(([id, { label, value }]) => (
              <LabelCard
                key={id}
                id={id}
                label={label}
                value={value}
                onEdit={() => setCurrentEdit(id)}
              />
            ))}
          </Stack>
        </section>
        <CssEditor />
      </div>
    </>
  );
}

function LabelCard(props: {
  id: string;
  label: string;
  value: string;
  onEdit(this: void): void;
}) {
  const href = useHref(routableGlobalSourcePath(props.id));
  return (
    <Card withBorder padding="sm" className={styles.textSourceCard}>
      <div>
        <p>{props.label}</p>
        <Title order={4}>{props.value}</Title>
      </div>
      <Group gap={4}>
        <ActionIcon variant="default" aria-label="Edit" onClick={props.onEdit}>
          <IconEdit size={16} />
        </ActionIcon>
        <ActionIcon
          variant="default"
          component="a"
          aria-label="Copy OBS source"
          onClick={(e) => {
            e.preventDefault();
            copyObsSource(new URL(href, document.location.href).href);
          }}
          href={href}
        >
          <IconCopy size={16} />
        </ActionIcon>
      </Group>
    </Card>
  );
}

function EditDialog({
  sourceId,
  close,
}: {
  sourceId: string | null;
  close(this: void): void;
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
    <Modal opened={!!sourceId} title="Edit Custom OBS label" onClose={close}>
      <form action={submit}>
        <TextInput
          label="Label Name"
          mb="sm"
          ref={nameInput}
          defaultValue={label.label}
          onKeyDown={handleInputKeydown}
        />
        <TextInput
          label="Value"
          mb="sm"
          ref={valueInput}
          defaultValue={label.value}
          onKeyDown={handleInputKeydown}
        />
      </form>
      <Group justify="flex-end" gap="xs" mt="md">
        <Button variant="default" onClick={close}>
          Cancel
        </Button>
        <Button onClick={submit}>Save</Button>
      </Group>
    </Modal>
  );
}

import { css } from "@codemirror/lang-css";

function CssEditor() {
  const cleanDoc = useAppState((s) => s.event.obsCss);
  const [isDirty, setIsDirty] = useState(false);
  const [localDoc, setLocalDoc] = useState(cleanDoc);
  const dispatch = useAppDispatch();
  const theme = useTheme();

  return (
    <section>
      <Title order={3} my="xs">
        Global OBS Source Styles{" "}
        <ActionIcon
          variant={isDirty ? "filled" : "default"}
          aria-label="Save styles"
          disabled={!isDirty}
          onClick={() => {
            dispatch(eventSlice.actions.updateObsCss(localDoc));
            setIsDirty(false);
          }}
        >
          <IconDeviceFloppy size={16} />
        </ActionIcon>
      </Title>
      <ReactCodeMirror
        height="200"
        minHeight="5"
        theme={theme}
        value={isDirty ? localDoc : cleanDoc}
        extensions={[css()]}
        onChange={(newDoc) => {
          if (newDoc === cleanDoc) {
            setIsDirty(false);
          } else {
            setIsDirty(true);
          }
          setLocalDoc(newDoc);
        }}
      />
    </section>
  );
}
