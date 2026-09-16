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
  Section,
  SectionCard,
} from "@blueprintjs/core";
import { useAppDispatch, useAppState } from "../state/store";
import {
  Add,
  Duplicate,
  FloppyDisk,
  GridView,
  History,
  List,
  Trash,
} from "@blueprintjs/icons";
import React, { JSX, useRef, useState } from "react";
import { eventSlice } from "../state/event.slice";
import { nanoid } from "nanoid";
import {
  copyObsSource,
  drawnChartsLayouts,
  routableDrawnChartsSourcePath,
  routableGlobalSourcePath,
  type DrawnChartsLayout,
} from "./copy-obs-source";
import { CabObsSources } from "./cab-obs-sources";
import { SourceRow } from "./obs-source-row";

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
        <section>
          <CabObsSources />
        </section>
        <DrawnChartsSources />
        <CssEditor />
      </div>
    </>
  );
}

const drawnChartsLayoutInfo: Record<
  DrawnChartsLayout,
  { label: string; icon: JSX.Element }
> = {
  grid: { label: "Grid (jackets)", icon: <GridView /> },
  list: { label: "List (text by level)", icon: <List /> },
};

function DrawnChartsSources() {
  return (
    <Section
      icon={<History />}
      title="Drawn Chart Sources"
      subtitle="What the event has already spent, so viewers can see what's left in the pool"
    >
      <SectionCard>
        <p className={styles.sourceHint}>
          Filtered to the level range of the config behind the most recent draw,
          which keeps it current on its own as the bracket climbs. Add{" "}
          <code>?config=&lt;config id&gt;</code>,{" "}
          <code>?min=15&amp;max=17</code> or <code>?all</code> to a source URL
          to say otherwise.
        </p>
        <CardList compact>
          {drawnChartsLayouts.map((layout) => (
            <DrawnChartsRow key={layout} layout={layout} />
          ))}
        </CardList>
      </SectionCard>
    </Section>
  );
}

function DrawnChartsRow({ layout }: { layout: DrawnChartsLayout }) {
  const href = useHref(routableDrawnChartsSourcePath(layout));
  const { label, icon } = drawnChartsLayoutInfo[layout];
  return (
    <SourceRow
      href={href}
      label={
        <>
          {icon}
          <span>{label}</span>
        </>
      }
    />
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
    <Card
      interactive
      className={styles.textSourceCard}
      title={`Edit "${props.label}"`}
      // a Blueprint card is a div, so editing by clicking the row costs the
      // keyboard access the edit button used to provide unless we put it back
      role="button"
      tabIndex={0}
      // the buttons inside mark their own clicks handled, so copying or
      // deleting doesn't also open the editor
      onClick={(e) => e.defaultPrevented || props.onEdit()}
      onKeyDown={(e) => {
        // a button inside the row answers its own Enter/Space first
        if (e.target !== e.currentTarget) return;
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          props.onEdit();
        }
      }}
    >
      <div>
        <p>{props.label}</p>
        <H4>{props.value}</H4>
      </div>
      <ButtonGroup>
        <AnchorButton
          icon={<Duplicate />}
          title="Copy this source's URL"
          onClick={(e) => {
            e.preventDefault();
            copyObsSource(new URL(href, document.location.href).href);
          }}
          href={href}
        />
        <Button
          icon={<Trash />}
          intent="danger"
          title="Delete this text source"
          onClick={(e) => {
            e.preventDefault();
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
