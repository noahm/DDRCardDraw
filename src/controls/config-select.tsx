import {
  Button,
  ButtonGroup,
  Card,
  HTMLSelect,
  Menu,
  MenuItem,
  Popover,
  Tooltip,
} from "@blueprintjs/core";
import {
  ThAdd,
  Duplicate,
  FloppyDisk,
  Import,
  Trash,
  More,
  DocumentShare,
} from "@blueprintjs/icons";
import { createAppSelector, useAppDispatch, useAppState } from "../state/store";
import styles from "./config-select.css";
import { createNewConfig } from "../state/thunks";
import { useRoomName } from "../hooks/useRoomName";
import { useSetLastConfigSelected } from "../state/config.atoms";
import { configSlice } from "../state/config.slice";
import { loadConfig, saveConfig } from "../config-persistence";
import { copyTextToClipboard } from "../utils/share";
import { useParams } from "react-router-dom";

const getConfigSummaryValues = createAppSelector(
  [(s) => s.config.entities],
  (entities) =>
    Object.entries(entities).map(
      ([key, config]) =>
        [
          key,
          config.name,
          config.gameKey,
          config.lowerBound,
          config.upperBound,
          config.chartCount,
          config.multiDraws?.configs.length
            ? `${config.multiDraws.configs.length} ${config.multiDraws.merge ? "draws" : "sets"}`
            : null,
        ] as const,
    ),
);

function getEmptyItemLabel(empty: boolean) {
  if (!empty) return "select a config";
  return "no configs created";
}

export function ConfigSelect(props: {
  selectedId: string | null;
  onChange(nextId: string): void;
}) {
  const summaryValues = useAppState(getConfigSummaryValues);
  const isEmpty = !summaryValues.length;

  return (
    <HTMLSelect
      disabled={isEmpty}
      value={props.selectedId || ""}
      onChange={(e) => props.onChange(e.currentTarget.value)}
    >
      <option disabled value="">
        {getEmptyItemLabel(isEmpty)}
      </option>
      {summaryValues.map(([key, name, gameKey, lb, ub]) => (
        <option key={key} value={key}>
          {name} ({gameKey}, {lb}-{ub})
        </option>
      ))}
    </HTMLSelect>
  );
}

export function ConfigList(props: {
  selectedId: string | null;
  onChange(nextId: string | null): void;
}) {
  const summaryValues = useAppState(getConfigSummaryValues);
  const dispatch = useAppDispatch();
  const roomName = useRoomName();
  const setLastConfigSelected = useSetLastConfigSelected();
  const params = useParams<"roomName">();

  const isEmpty = !summaryValues.length;

  function changeConfig(key: string | null) {
    props.onChange(key);
    setLastConfigSelected(key || undefined);
  }
  return (
    <div className={styles.listContainer}>
      {isEmpty && getEmptyItemLabel(true)}
      {summaryValues.map(
        ([key, name, gameKey, lb, ub, count, multiDraws], idx) => (
          <Card
            key={key}
            interactive
            onClick={(e) => e.defaultPrevented || changeConfig(key)}
            selected={props.selectedId === key}
            compact
          >
            {props.selectedId === key && (
              <ConfigActionsMenu
                onShareLink={() => {
                  const url = new URL(document.location.href);
                  url.pathname = `/preview/${params.roomName}`;
                  url.search = "?configId=" + key;
                  copyTextToClipboard(
                    url.href,
                    "Preview URL copied to clipboard",
                  );
                }}
                onExport={() => {
                  saveConfig(
                    dispatch((_, gs) =>
                      configSlice.selectors.selectById(gs(), key),
                    ),
                  );
                }}
                onDuplicate={() => {
                  dispatch(createNewConfig(roomName, key)).then((c) =>
                    changeConfig(c.id),
                  );
                }}
                onDelete={() => {
                  if (!confirm(`Are you sure you want to delete "${name}"?`))
                    return;
                  const nextIdx =
                    idx < summaryValues.length - 1 ? idx + 1 : idx - 1;
                  const nextConfigId =
                    nextIdx > -1 ? summaryValues[nextIdx][0] : null;
                  changeConfig(nextConfigId);
                  dispatch(configSlice.actions.removeOne(key));
                }}
              />
            )}
            <h2>{name}</h2>
            <p>
              {gameKey}, draw {count}, lvl {lb}&ndash;{ub}
              <br />
              {multiDraws && ` (+${multiDraws})`}
            </p>
          </Card>
        ),
      )}
      <Card compact style={{ opacity: 0.6 }}>
        <ButtonGroup className={styles.actionButtons}>
          <Tooltip content={"Import from JSON"} placement="top">
            <Button
              icon={<Import />}
              onClick={() => {
                loadConfig().then((c) => {
                  dispatch(configSlice.actions.addOne(c));
                  changeConfig(c.id);
                });
              }}
            />
          </Tooltip>
          <Tooltip content={"New Config"} placement="top">
            <Button
              icon={<ThAdd />}
              onClick={() =>
                dispatch(createNewConfig(roomName)).then((c) =>
                  changeConfig(c.id),
                )
              }
            />
          </Tooltip>
        </ButtonGroup>
        <h2>Create new</h2>
      </Card>
    </div>
  );
}

function ConfigActionsMenu(props: {
  onExport(): void;
  onShareLink(): void;
  onDuplicate(): void;
  onDelete(): void;
}) {
  const menu = (
    <Menu>
      <MenuItem
        icon={<FloppyDisk />}
        text="Export to JSON"
        onClick={props.onExport}
      />
      <MenuItem
        icon={<DocumentShare />}
        text="Share preview link"
        onClick={props.onShareLink}
      />
      <MenuItem
        icon={<Duplicate />}
        text="Duplicate"
        onClick={(e) => {
          e.preventDefault();
          props.onDuplicate();
        }}
      />
      <MenuItem
        icon={<Trash />}
        text="Delete"
        onClick={(e) => {
          e.preventDefault();
          props.onDelete();
        }}
      />
    </Menu>
  );
  return (
    <Popover className={styles.actionButtons} content={menu}>
      <Button icon={<More />} />
    </Popover>
  );
}
