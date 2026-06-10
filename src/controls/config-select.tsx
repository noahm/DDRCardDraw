import {
  ActionIcon,
  Card,
  Group,
  Menu,
  NativeSelect,
  Tooltip,
} from "@mantine/core";
import {
  IconTablePlus,
  IconCopy,
  IconDeviceFloppy,
  IconFileImport,
  IconTrash,
  IconDots,
  IconShare2,
} from "@tabler/icons-react";
import { useAppDispatch, useAppState } from "../state/store";
import styles from "./config-select.css";
import { createNewConfig } from "../state/thunks";
import { useRoomName } from "../hooks/useRoomName";
import { useSetLastConfigSelected } from "../state/config.atoms";
import { configSlice } from "../state/config.slice";
import { loadConfig, saveConfig } from "../config-persistence";
import { copyTextToClipboard } from "../utils/share";
import { useStockGameData } from "../state/game-data.atoms";

function getEmptyItemLabel(empty: boolean) {
  if (!empty) return "select a config";
  return "no configs created";
}

export function ConfigSelect(props: {
  selectedId: string | null;
  onChange(nextId: string): void;
}) {
  const configIds = useAppState((s) => s.config.ids);
  const isEmpty = !configIds.length;

  return (
    <NativeSelect
      disabled={isEmpty}
      value={props.selectedId || ""}
      onChange={(e) => props.onChange(e.currentTarget.value)}
    >
      <option disabled value="">
        {getEmptyItemLabel(isEmpty)}
      </option>
      {configIds.map((configId) => (
        <ConfigSelectEntry key={configId} configId={configId} />
      ))}
    </NativeSelect>
  );
}

function ConfigSelectEntry(props: { configId: string }) {
  const config = useAppState((s) =>
    configSlice.selectors.selectById(s, props.configId),
  );
  return (
    <option value={config.id}>
      {config.name} ({config.gameKey}, {config.lowerBound}-{config.upperBound})
    </option>
  );
}

export function ConfigList(props: {
  selectedId: string | null;
  onChange(nextId: string | null): void;
}) {
  const configIds = useAppState((s) => s.config.ids);
  const dispatch = useAppDispatch();
  const roomName = useRoomName();
  const setLastConfigSelected = useSetLastConfigSelected();

  const isEmpty = !configIds.length;

  function changeConfig(key: string | null) {
    props.onChange(key);
    setLastConfigSelected(key || undefined);
  }
  function nextConfigId(idx: number) {
    const nextIdx = idx < configIds.length - 1 ? idx + 1 : idx - 1;
    return nextIdx > -1 ? configIds[nextIdx] : null;
  }
  return (
    <div className={styles.listContainer}>
      {isEmpty && getEmptyItemLabel(true)}
      {configIds.map((cid, idx) => (
        <ConfigListEntry
          key={cid}
          configId={cid}
          selectConfig={changeConfig}
          nextConfigId={nextConfigId(idx)}
          selected={props.selectedId === cid}
        />
      ))}
      <Card withBorder padding="sm" style={{ opacity: 0.6 }}>
        <Group gap={4} className={styles.actionButtons}>
          <Tooltip label="Import from JSON" position="top">
            <ActionIcon
              variant="default"
              aria-label="Import from JSON"
              onClick={() => {
                void loadConfig().then((c) => {
                  dispatch(configSlice.actions.addOne(c));
                  changeConfig(c.id);
                });
              }}
            >
              <IconFileImport size={16} />
            </ActionIcon>
          </Tooltip>
          <Tooltip label="New Config" position="top">
            <ActionIcon
              variant="default"
              aria-label="New Config"
              onClick={() =>
                dispatch(createNewConfig(roomName)).then((c) =>
                  changeConfig(c.id),
                )
              }
            >
              <IconTablePlus size={16} />
            </ActionIcon>
          </Tooltip>
        </Group>
        <h2>Create new</h2>
      </Card>
    </div>
  );
}

function ConfigListEntry(props: {
  configId: string;
  selected: boolean;
  /** config to select when deleting this one */
  nextConfigId: string | null;
  selectConfig(configId: string | null): void;
}) {
  const roomName = useRoomName();
  const dispatch = useAppDispatch();
  const config = useAppState((s) =>
    configSlice.selectors.selectById(s, props.configId),
  );
  const gameData = useStockGameData(config.gameKey);
  const multiDraws = config.multiDraws?.configs.length
    ? `${config.multiDraws.configs.length} ${config.multiDraws.merge ? "draws" : "sets"}`
    : null;
  return (
    <Card
      withBorder
      padding="sm"
      onClick={(e) => e.defaultPrevented || props.selectConfig(props.configId)}
      style={{
        cursor: "pointer",
        borderColor: props.selected
          ? "var(--mantine-primary-color-filled)"
          : undefined,
      }}
    >
      {props.selected && (
        <ConfigActionsMenu
          onShareLink={() => {
            const url = new URL(document.location.href);
            url.pathname = `/preview/${roomName}`;
            url.search = "?configId=" + props.configId;
            void copyTextToClipboard(
              url.href,
              "Preview URL copied to clipboard",
            );
          }}
          onExport={() => {
            void saveConfig(
              dispatch((_, gs) =>
                configSlice.selectors.selectById(gs(), props.configId),
              ),
            );
          }}
          onDuplicate={() => {
            void dispatch(createNewConfig(roomName, props.configId)).then((c) =>
              props.selectConfig(c.id),
            );
          }}
          onDelete={() => {
            if (!confirm(`Are you sure you want to delete "${config.name}"?`))
              return;
            props.selectConfig(props.nextConfigId);
            dispatch(configSlice.actions.removeOne(config.id));
          }}
        />
      )}
      <h2>{config.name}</h2>
      <p>
        {config.gameKey}, draw {config.chartCount},{" "}
        {gameData?.meta.usesDrawGroups ? "tier" : "lvl"} {config.lowerBound}
        &ndash;{config.upperBound}
        <br />
        {multiDraws && ` (+${multiDraws})`}
      </p>
    </Card>
  );
}

function ConfigActionsMenu(props: {
  onExport(this: void): void;
  onShareLink(this: void): void;
  onDuplicate(): void;
  onDelete(): void;
}) {
  return (
    <Menu position="bottom-end">
      <Menu.Target>
        <ActionIcon
          variant="default"
          className={styles.actionButtons}
          onClick={(e) => e.preventDefault()}
          aria-label="Config actions"
        >
          <IconDots size={16} />
        </ActionIcon>
      </Menu.Target>
      <Menu.Dropdown>
        <Menu.Item
          leftSection={<IconDeviceFloppy size={16} />}
          onClick={props.onExport}
        >
          Export to JSON
        </Menu.Item>
        <Menu.Item
          leftSection={<IconShare2 size={16} />}
          onClick={props.onShareLink}
        >
          Share preview link
        </Menu.Item>
        <Menu.Item
          leftSection={<IconCopy size={16} />}
          onClick={(e) => {
            e.preventDefault();
            props.onDuplicate();
          }}
        >
          Duplicate
        </Menu.Item>
        <Menu.Item
          leftSection={<IconTrash size={16} />}
          onClick={(e) => {
            e.preventDefault();
            props.onDelete();
          }}
        >
          Delete
        </Menu.Item>
      </Menu.Dropdown>
    </Menu>
  );
}
