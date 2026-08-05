import {
  Button,
  ButtonGroup,
  Card,
  Checkbox,
  Dialog,
  DialogBody,
  DialogFooter,
  HTMLSelect,
  Menu,
  MenuItem,
  Popover,
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
import { useState } from "react";
import { useAppDispatch, useAppState, useAppStore } from "../state/store";
import styles from "./config-select.css";
import { createNewConfig } from "../state/thunks";
import { useRoomName } from "../hooks/useRoomName";
import { useSetLastConfigSelected } from "../state/config.atoms";
import { configSlice } from "../state/config.slice";
import { loadConfigs, saveConfig, saveConfigs } from "../config-persistence";
import { copyTextToClipboard } from "../utils/share";
import { useStockGameData } from "../state/game-data.atoms";
import { toaster } from "../toaster";

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
    <HTMLSelect
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
    </HTMLSelect>
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
        toaster.show({
          message: importToastMessage(configs.length, updated),
          icon: "import",
          intent: "success",
        });
      }
    });
  }
  return (
    <div className={styles.listContainer}>
      {!isEmpty && (
        <Button
          variant="minimal"
          icon={<FloppyDisk />}
          text="Export configs…"
          onClick={() => setExportOpen(true)}
        />
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
      <Card compact style={{ opacity: 0.6 }}>
        <h2>Create config…</h2>
        <ButtonGroup fill>
          <Button
            icon={<Import />}
            text="From JSON"
            title="Import one or more configs from a file"
            onClick={importConfigs}
          />
          <Button
            icon={<ThAdd />}
            text="From scratch"
            onClick={() =>
              dispatch(createNewConfig(roomName)).then((c) =>
                changeConfig(c.id),
              )
            }
          />
        </ButtonGroup>
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
    <Dialog
      isOpen={props.isOpen}
      title="Export configs"
      onClose={props.onClose}
    >
      {props.isOpen && <BatchExportForm onClose={props.onClose} />}
    </Dialog>
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
      <DialogBody>
        <Checkbox
          checked={allSelected}
          indeterminate={!allSelected && selectedIds.size > 0}
          onChange={toggleAll}
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
      </DialogBody>
      <DialogFooter
        actions={
          <Button
            intent="primary"
            icon={<FloppyDisk />}
            disabled={!selectedIds.size}
            onClick={handleExport}
          >
            Export {selectedIds.size}
          </Button>
        }
      />
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
  return (
    <Checkbox
      checked={props.checked}
      onChange={() => props.onToggle(props.configId)}
      label={`${config.name} (${config.gameKey}, ${config.lowerBound}-${config.upperBound})`}
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
  const gameData = useStockGameData(config.gameKey);
  const multiDraws = config.multiDraws?.configs.length
    ? `${config.multiDraws.configs.length} ${config.multiDraws.merge ? "draws" : "sets"}`
    : null;
  return (
    <Card
      interactive
      onClick={(e) => e.defaultPrevented || props.selectConfig(props.configId)}
      selected={props.selected}
      compact
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
        intent="danger"
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
