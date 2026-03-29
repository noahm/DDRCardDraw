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
import { useRoomState } from "../jazz/app-state-context";
import { useMutations } from "../jazz/use-mutations";
import styles from "./config-select.css";
import { useRoomName } from "../hooks/useRoomName";
import { useSetLastConfigSelected } from "../state/config.atoms";
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
  const configIds = useRoomState((s) => s.config.ids);
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
  const config = useRoomState((s) => s.config.entities[props.configId]);
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
  const configIds = useRoomState((s) => s.config.ids);
  const mutations = useMutations();
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
      <Card compact style={{ opacity: 0.6 }}>
        <ButtonGroup className={styles.actionButtons}>
          <Tooltip content={"Import from JSON"} placement="top">
            <Button
              icon={<Import />}
              onClick={() => {
                loadConfig().then((c) => {
                  mutations.addConfig(c);
                  changeConfig(c.id);
                });
              }}
            />
          </Tooltip>
          <Tooltip content={"New Config"} placement="top">
            <Button
              icon={<ThAdd />}
              onClick={() =>
                mutations.newConfig().then((c) =>
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

function ConfigListEntry(props: {
  configId: string;
  selected: boolean;
  /** config to select when deleting this one */
  nextConfigId: string | null;
  selectConfig(configId: string | null): void;
}) {
  const roomName = useRoomName();
  const mutations = useMutations();
  const config = useRoomState((s) => s.config.entities[props.configId]);
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
            copyTextToClipboard(url.href, "Preview URL copied to clipboard");
          }}
          onExport={() => {
            saveConfig(config);
          }}
          onDuplicate={() => {
            mutations.newConfig(props.configId).then((c) =>
              props.selectConfig(c.id),
            );
          }}
          onDelete={() => {
            if (!confirm(`Are you sure you want to delete "${config.name}"?`))
              return;
            props.selectConfig(props.nextConfigId);
            mutations.removeConfig(config.id);
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
