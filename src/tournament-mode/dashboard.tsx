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
import { useIntl } from "../hooks/useIntl";
import ReactCodeMirror from "@uiw/react-codemirror";

export function Dashboard() {
  const { t, formatMessage } = useIntl();
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
              {formatMessage(
                { id: "obsDashboard.dockHint" },
                { b: (text) => <b>{text}</b> },
              )}
            </em>
          </p>
        )}
        <section style={{ maxWidth: "600px" }}>
          <EditDialog
            sourceId={currentEdit}
            close={() => setCurrentEdit(null)}
          />
          <H3>
            {t("obsDashboard.textSources")}{" "}
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
  { labelKey: string; icon: JSX.Element }
> = {
  grid: { labelKey: "obsDashboard.layoutGrid", icon: <GridView /> },
  list: { labelKey: "obsDashboard.layoutList", icon: <List /> },
};

function DrawnChartsSources() {
  const { t, formatMessage } = useIntl();
  return (
    <Section
      icon={<History />}
      title={t("obsDashboard.drawnChartSources")}
      subtitle={t("obsDashboard.drawnChartSourcesHint")}
    >
      <SectionCard>
        {/* the params are syntax rather than language, so they stay out of the
            translated sentence and go in as fixed pieces around it */}
        <p className={styles.sourceHint}>
          {formatMessage(
            { id: "obsDashboard.drawnChartsParamHint" },
            {
              configParam: <code>?config=&lt;config id&gt;</code>,
              rangeParam: <code>?min=15&amp;max=17</code>,
              allParam: <code>?all</code>,
            },
          )}
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
  const { t } = useIntl();
  const href = useHref(routableDrawnChartsSourcePath(layout));
  const { labelKey, icon } = drawnChartsLayoutInfo[layout];
  return (
    <SourceRow
      href={href}
      label={
        <>
          {icon}
          <span>{t(labelKey)}</span>
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
  const { t } = useIntl();
  const href = useHref(routableGlobalSourcePath(props.id));
  return (
    <Card
      interactive
      className={styles.textSourceCard}
      title={t("obsDashboard.editLabel", { label: props.label })}
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
          title={t("obsDashboard.copyLabelUrl")}
          onClick={(e) => {
            e.preventDefault();
            copyObsSource(
              new URL(href, document.location.href).href,
              t("obsDashboard.copiedToClipboard"),
            );
          }}
          href={href}
        />
        <Button
          icon={<Trash />}
          intent="danger"
          title={t("obsDashboard.deleteLabel")}
          onClick={(e) => {
            e.preventDefault();
            if (
              confirm(
                t("obsDashboard.deleteLabelConfirm", { label: props.label }),
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
  const { t } = useIntl();
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
    <Dialog
      isOpen={!!sourceId}
      title={t("obsDashboard.editLabelTitle")}
      onClose={close}
    >
      <DialogBody>
        <form action={submit}>
          <FormGroup label={t("obsDashboard.labelName")}>
            <InputGroup
              inputRef={nameInput}
              defaultValue={label.label}
              onKeyDown={handleInputKeydown}
            />
          </FormGroup>
          <FormGroup label={t("obsDashboard.labelValue")}>
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
            <Button onClick={close}>{t("obsDashboard.cancel")}</Button>
            <Button intent="primary" onClick={submit}>
              {t("obsDashboard.save")}
            </Button>
          </>
        }
      />
    </Dialog>
  );
}

import { css } from "@codemirror/lang-css";

function CssEditor() {
  const { t } = useIntl();
  const cleanDoc = useAppState((s) => s.event.obsCss);
  const [isDirty, setIsDirty] = useState(false);
  const [localDoc, setLocalDoc] = useState(cleanDoc);
  const dispatch = useAppDispatch();
  const theme = useTheme();

  return (
    <section>
      <H3>
        {t("obsDashboard.globalStyles")}{" "}
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
