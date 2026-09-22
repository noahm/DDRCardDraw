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
  IconDeviceFloppy,
  IconHistory,
  IconLayoutGrid,
  IconList,
  IconTrash,
} from "@tabler/icons-react";
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

import { Section } from "../common-components/section";
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
          <Title order={3} mb="xs">
            {t("obsDashboard.textSources")}{" "}
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
                onDelete={() =>
                  dispatch(eventSlice.actions.removeLabel({ id }))
                }
              />
            ))}
          </Stack>
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
  grid: {
    labelKey: "obsDashboard.layoutGrid",
    icon: <IconLayoutGrid size={16} />,
  },
  list: { labelKey: "obsDashboard.layoutList", icon: <IconList size={16} /> },
};

function DrawnChartsSources() {
  const { t, formatMessage } = useIntl();
  return (
    <Section
      icon={<IconHistory size={20} />}
      title={t("obsDashboard.drawnChartSources")}
      subtitle={t("obsDashboard.drawnChartSourcesHint")}
    >
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
      <Stack gap="xs">
        {drawnChartsLayouts.map((layout) => (
          <DrawnChartsRow key={layout} layout={layout} />
        ))}
      </Stack>
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
      withBorder
      padding="sm"
      className={styles.textSourceCard}
      title={t("obsDashboard.editLabel", { label: props.label })}
      // editing by clicking the row costs the keyboard access the edit button
      // used to provide unless we put it back
      role="button"
      tabIndex={0}
      style={{ cursor: "pointer" }}
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
        <Title order={4}>{props.value}</Title>
      </div>
      <Group gap={4}>
        <ActionIcon
          variant="default"
          component="a"
          aria-label={t("obsDashboard.copyLabelUrl")}
          title={t("obsDashboard.copyLabelUrl")}
          onClick={(e) => {
            e.preventDefault();
            copyObsSource(
              new URL(href, document.location.href).href,
              t("obsDashboard.copiedToClipboard"),
            );
          }}
          href={href}
        >
          <IconCopy size={16} />
        </ActionIcon>
        <ActionIcon
          variant="default"
          color="red"
          aria-label={t("obsDashboard.deleteLabel")}
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
        >
          <IconTrash size={16} />
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
    <Modal
      opened={!!sourceId}
      title={t("obsDashboard.editLabelTitle")}
      onClose={close}
    >
      <form action={submit}>
        <TextInput
          label={t("obsDashboard.labelName")}
          mb="sm"
          ref={nameInput}
          defaultValue={label.label}
          onKeyDown={handleInputKeydown}
        />
        <TextInput
          label={t("obsDashboard.labelValue")}
          mb="sm"
          ref={valueInput}
          defaultValue={label.value}
          onKeyDown={handleInputKeydown}
        />
      </form>
      <Group justify="flex-end" gap="xs" mt="md">
        <Button variant="default" onClick={close}>
          {t("obsDashboard.cancel")}
        </Button>
        <Button onClick={submit}>{t("obsDashboard.save")}</Button>
      </Group>
    </Modal>
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
      <Title order={3} my="xs">
        {t("obsDashboard.globalStyles")}{" "}
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
