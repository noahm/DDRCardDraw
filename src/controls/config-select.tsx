import {
  Button,
  ButtonGroup,
  Card,
  HTMLSelect,
  Tooltip,
} from "@blueprintjs/core";
import { Add, Duplicate, FloppyDisk, Import, Trash } from "@blueprintjs/icons";
import { createAppSelector, useAppDispatch, useAppState } from "../state/store";
import styles from "./config-select.css";
import { createNewConfig } from "../state/thunks";
import { useRoomName } from "../hooks/useRoomName";
import { useSetLastConfigSelected } from "../state/config.atoms";
import { configSlice } from "../state/config.slice";
import { loadConfig, saveConfig } from "../config-persistence";

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
        ] as const,
    ),
);

function getEmptyItemLabel(empty: boolean, direction?: "left" | "right") {
  if (!empty) return "select a config";
  switch (direction) {
    case "left":
      return "👈 Create a config here";
    case "right":
      return "Create a config here 👉";
    default:
      return "no configs created";
  }
}

export function ConfigSelect(props: {
  selectedId: string | null;
  onChange(nextId: string | null): void;
  createDirection?: "left" | "right";
  asList?: boolean;
}) {
  const summaryValues = useAppState(getConfigSummaryValues);
  const dispatch = useAppDispatch();
  const roomName = useRoomName();
  const setLastConfigSelected = useSetLastConfigSelected();

  const isEmpty = !summaryValues.length;

  function changeConfig(key: string | null) {
    props.onChange(key);
    setLastConfigSelected(key || undefined);
  }

  if (props.asList) {
    return (
      <div className={styles.listContainer}>
        {isEmpty && getEmptyItemLabel(true, props.createDirection)}
        {summaryValues.map(([key, name, gameKey, lb, ub, count], idx) => (
          <Card
            key={key}
            interactive
            onClick={(e) => e.defaultPrevented || changeConfig(key)}
            selected={props.selectedId === key}
            compact
          >
            {props.selectedId === key && (
              <ButtonGroup className={styles.actionButtons}>
                <Button
                  icon={<FloppyDisk />}
                  onClick={() => {
                    saveConfig(
                      dispatch((_, gs) =>
                        configSlice.selectors.selectById(gs(), key),
                      ),
                    );
                  }}
                />
                <Button
                  icon={<Duplicate />}
                  onClick={(e) => {
                    e.preventDefault();
                    dispatch(createNewConfig(roomName, key)).then((c) =>
                      changeConfig(c.id),
                    );
                  }}
                />
                <Button
                  icon={<Trash />}
                  onClick={(e) => {
                    e.preventDefault();
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
              </ButtonGroup>
            )}
            <h2>{name}</h2>
            <p>
              {gameKey}, draw {count}, lvl {lb}&ndash;{ub}
            </p>
          </Card>
        ))}
        <Card compact style={{ opacity: 0.6 }}>
          <ButtonGroup className={styles.actionButtons}>
            <Tooltip content={"Import JSON"} placement="top">
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
            <Button
              icon={<Add />}
              onClick={() =>
                dispatch(createNewConfig(roomName)).then((c) =>
                  changeConfig(c.id),
                )
              }
            />
          </ButtonGroup>
          <h2>Create new</h2>
        </Card>
      </div>
    );
  }

  return (
    <HTMLSelect
      disabled={isEmpty}
      value={props.selectedId || ""}
      onChange={(e) => props.onChange(e.currentTarget.value)}
    >
      <option disabled value="">
        {getEmptyItemLabel(isEmpty, props.createDirection)}
      </option>
      {summaryValues.map(([key, name, gameKey, lb, ub]) => (
        <option key={key} value={key}>
          {name} ({gameKey}, {lb}-{ub})
        </option>
      ))}
    </HTMLSelect>
  );
}
