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
import { Add, Duplicate, Edit, FloppyDisk, Trash } from "@blueprintjs/icons";
import React, { useRef, useState } from "react";
import { eventSlice } from "../state/event.slice";
import { nanoid } from "nanoid";
import {
  copyObsSource,
  drawnChartsLayouts,
  routableDrawnChartsSourcePath,
  routableGlobalSourcePath,
  type DrawnChartsLayout,
} from "./copy-obs-source";

import styles from "./dashboard.css";
import { useInObs, useTheme } from "../theme-toggle";
import { useHref } from "react-router-dom";
import ReactCodeMirror from "@uiw/react-codemirror";

export function Dashboard() {
  const [currentEdit, setCurrentEdit] = useState<string | null>(null);
  const labels = useAppState((s) => s.event.obsLabels);
  const isObs = useInObs();
  const dispatch = useAppDispatch();

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
                onDelete={() =>
                  dispatch(eventSlice.actions.removeLabel({ id }))
                }
              />
            ))}
          </CardList>
        </section>
        <DrawnChartsSources />
        <CssEditor />
      </div>
    </>
  );
}

const drawnChartsLayoutInfo: Record<
  DrawnChartsLayout,
  { title: string; detail: string }
> = {
  grid: {
    title: "Grid",
    detail: "A mini jacket, song name and level for each chart.",
  },
  list: {
    title: "List",
    detail:
      "Text rows grouped by level, no jackets. Fits several times as many charts in the same space.",
  },
};

function DrawnChartsSources() {
  return (
    <section style={{ maxWidth: "600px" }}>
      <H3>OBS Drawn Chart Sources</H3>
      <p>
        Every chart this event has already drawn, so viewers can see what has
        come out of the pool. Filtered by default to the level range of the
        config behind the most recent draw, which keeps it current on its own as
        the bracket climbs. Add <code>?config=&lt;config id&gt;</code>,{" "}
        <code>?min=15&amp;max=17</code> or <code>?all</code> to a source URL to
        say otherwise.
      </p>
      <CardList>
        {drawnChartsLayouts.map((layout) => (
          <DrawnChartsCard key={layout} layout={layout} />
        ))}
      </CardList>
    </section>
  );
}

function DrawnChartsCard(props: { layout: DrawnChartsLayout }) {
  const href = useHref(routableDrawnChartsSourcePath(props.layout));
  const { title, detail } = drawnChartsLayoutInfo[props.layout];
  return (
    <Card className={styles.textSourceCard}>
      <div>
        <H4>{title}</H4>
        <p>{detail}</p>
      </div>
      <AnchorButton
        icon={<Duplicate />}
        title="Copy this source's URL to the clipboard"
        onClick={(e) => {
          e.preventDefault();
          copyObsSource(new URL(href, document.location.href).href);
        }}
        href={href}
      />
    </Card>
  );
}

function LabelCard(props: {
  id: string;
  label: string;
  value: string;
  onEdit(this: void): void;
  onDelete(this: void): void;
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
            copyObsSource(new URL(href, document.location.href).href);
          }}
          href={href}
        />
        <Button
          icon={<Trash />}
          intent="danger"
          onClick={() => {
            if (
              confirm(
                `Delete the "${props.label}" text source? This cannot be undone.`,
              )
            ) {
              props.onDelete();
            }
          }}
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

import { css } from "@codemirror/lang-css";

function CssEditor() {
  const cleanDoc = useAppState((s) => s.event.obsCss);
  const [isDirty, setIsDirty] = useState(false);
  const [localDoc, setLocalDoc] = useState(cleanDoc);
  const dispatch = useAppDispatch();
  const theme = useTheme();

  return (
    <section>
      <H3>
        Global OBS Source Styles{" "}
        <Button
          icon={<FloppyDisk />}
          disabled={!isDirty}
          intent={isDirty ? "primary" : undefined}
          onClick={() => {
            dispatch(eventSlice.actions.updateObsCss(localDoc));
            setIsDirty(false);
          }}
        />
      </H3>
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
