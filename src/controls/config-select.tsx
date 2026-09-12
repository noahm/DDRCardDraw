import {
  ActionIcon,
  Button,
  Card,
  Checkbox,
  Group,
  Menu,
  Modal,
  NativeSelect,
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
import { useState } from "react";
import { useAppDispatch, useAppState, useAppStore } from "../state/store";
import styles from "./config-select.css";
import { createNewConfig } from "../state/thunks";
import { useRoomName } from "../hooks/useRoomName";
import { useSetLastConfigSelected } from "../state/config.atoms";
import { configSlice } from "../state/config.slice";
import { loadConfigs, saveConfig, saveConfigs } from "../config-persistence";
import { copyTextToClipboard } from "../utils/share";
import { useGameDataForKey } from "../state/game-data.atoms";
import { notify } from "../notify";

function getEmptyItemLabel(empty: boolean) {
  if (!empty) return "select a config";
  return "no configs created";
}

function pluralizeConfigs(count: number) {
  return `${count} config${count === 1 ? "" : "s"}`;
}

/**
 * @param total configs in the imported file
 * @param updated how many of them replaced an existing config
 **/
function importToastMessage(total: number, updated: number) {
  if (updated === total) {
    return `Updated ${pluralizeConfigs(updated)}`;
  }
  if (updated > 0) {
    return `Imported ${pluralizeConfigs(total)} (updated ${updated} existing)`;
  }
  return `Imported ${pluralizeConfigs(total)}`;
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
  const gameData = useGameDataForKey(config.gameKey);
  const gameName = (gameData?.i18n.en.name as string) || config.gameKey;
  return (
    <option value={config.id}>
      {config.name} ({gameName}, {config.lowerBound}-{config.upperBound})
    </option>
  );
}

export function ConfigList(props: {
  selectedId: string | null;
  onChange(nextId: string | null): void;
}) {
  const configIds = useAppState((s) => s.config.ids);
  const dispatch = useAppDispatch();
  const store = useAppStore();
  const roomName = useRoomName();
  const setLastConfigSelected = useSetLastConfigSelected();
  const [exportOpen, setExportOpen] = useState(false);

  const isEmpty = !configIds.length;

  function changeConfig(key: string | null) {
    props.onChange(key);
    setLastConfigSelected(key || undefined);
  }
  function nextConfigId(idx: number) {
    const nextIdx = idx < configIds.length - 1 ? idx + 1 : idx - 1;
    return nextIdx > -1 ? configIds[nextIdx] : null;
  }
  function importConfigs() {
    void loadConfigs().then((configs) => {
      const existingIds = configSlice.selectors.selectIds(store.getState());
      const updated = configs.filter((c) => existingIds.includes(c.id)).length;
      dispatch(configSlice.actions.setMany(configs));
      const last = configs[configs.length - 1];
      if (last) {
        changeConfig(last.id);
      }
      if (configs.length > 1 || updated) {
        notify.show({
          message: importToastMessage(configs.length, updated),
          icon: <IconFileImport />,
          intent: "success",
        });
      }
    });
  }
  return (
    <div className={styles.listContainer}>
      {!isEmpty && (
        <Button
          variant="subtle"
          color="gray"
          justify="flex-start"
          leftSection={<IconDeviceFloppy size={16} />}
          onClick={() => setExportOpen(true)}
        >
          Export configs…
        </Button>
      )}
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
        <h2>Create config…</h2>
        <Button.Group orientation="vertical">
          <Button
            variant="default"
            justify="flex-start"
            leftSection={<IconFileImport size={16} />}
            title="Import one or more configs from a file"
            onClick={importConfigs}
          >
            From JSON
          </Button>
          <Button
            variant="default"
            justify="flex-start"
            leftSection={<IconTablePlus size={16} />}
            onClick={() =>
              dispatch(createNewConfig(roomName)).then((c) =>
                changeConfig(c.id),
              )
            }
          >
            From scratch
          </Button>
        </Button.Group>
      </Card>
      <BatchExportDialog
        isOpen={exportOpen}
        onClose={() => setExportOpen(false)}
      />
    </div>
  );
}

function BatchExportDialog(props: { isOpen: boolean; onClose: () => void }) {
  return (
    <Modal opened={props.isOpen} title="Export configs" onClose={props.onClose}>
      {props.isOpen && <BatchExportForm onClose={props.onClose} />}
    </Modal>
  );
}

function BatchExportForm(props: { onClose: () => void }) {
  const configIds = useAppState((s) => s.config.ids);
  const store = useAppStore();
  const [selectedIds, setSelectedIds] = useState<Set<string>>(
    () => new Set(configIds as string[]),
  );

  function toggle(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  const allSelected = selectedIds.size === configIds.length;
  function toggleAll() {
    setSelectedIds(allSelected ? new Set() : new Set(configIds as string[]));
  }

  function handleExport() {
    const configs = configSlice.selectors
      .selectAll(store.getState())
      .filter((c) => selectedIds.has(c.id));
    void saveConfigs(configs);
    props.onClose();
  }

  return (
    <>
      <Checkbox
        checked={allSelected}
        indeterminate={!allSelected && selectedIds.size > 0}
        onChange={toggleAll}
        my={4}
        label="Select all"
      />
      {(configIds as string[]).map((cid) => (
        <BatchExportRow
          key={cid}
          configId={cid}
          checked={selectedIds.has(cid)}
          onToggle={toggle}
        />
      ))}
      <Group justify="flex-end" mt="md">
        <Button
          leftSection={<IconDeviceFloppy size={16} />}
          disabled={!selectedIds.size}
          onClick={handleExport}
        >
          Export {selectedIds.size}
        </Button>
      </Group>
    </>
  );
}

function BatchExportRow(props: {
  configId: string;
  checked: boolean;
  onToggle(id: string): void;
}) {
  const config = useAppState((s) =>
    configSlice.selectors.selectById(s, props.configId),
  );
  const gameData = useGameDataForKey(config.gameKey);
  const gameName = (gameData?.i18n.en.name as string) || config.gameKey;
  return (
    <Checkbox
      checked={props.checked}
      onChange={() => props.onToggle(props.configId)}
      my={4}
      label={`${config.name} (${gameName}, ${config.lowerBound}-${config.upperBound})`}
    />
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
  const gameData = useGameDataForKey(config.gameKey);
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
        {(gameData?.i18n.en.name as string) || config.gameKey}, draw{" "}
        {config.chartCount}, {gameData?.meta.usesDrawGroups ? "tier" : "lvl"}{" "}
        {config.lowerBound}
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
          color="red"
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
