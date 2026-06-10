import {
  ActionIcon,
  Button,
  Card,
  Collapse,
  Group,
  Input,
  Switch,
} from "@mantine/core";
import { useConfigState, useUpdateConfig } from "../state/hooks";
import { ConfigSelect } from "./config-select";
import { IconCaretDown, IconCaretRight, IconTrash } from "@tabler/icons-react";
import { useState } from "react";

export function MultidrawControls() {
  const updateState = useUpdateConfig();
  const multidrawState = useConfigState((s) => s.multiDraws);
  const currentId = useConfigState((s) => s.id);
  const addExtraDraw = () => {
    const configs = multidrawState?.configs.slice() || [];
    configs.push(currentId);
    updateState({
      multiDraws: {
        merge: !!multidrawState?.merge,
        configs,
      },
    });
  };
  const [collapseOpen, setCollapseOpen] = useState(
    !!multidrawState?.configs.length,
  );
  const toggleCollapse = () => {
    setCollapseOpen((prev) => !prev);
  };

  const changeConfigAtIdx = (newConfig: string, atIdx: number) => {
    if (!multidrawState) return;
    updateState({
      multiDraws: {
        merge: multidrawState?.merge,
        configs: multidrawState.configs.map((str, idx) =>
          idx === atIdx ? newConfig : str,
        ),
      },
    });
  };
  const rmConfigAtIdx = (atIdx: number) => {
    if (!multidrawState) return;
    updateState({
      multiDraws: {
        merge: multidrawState.merge,
        configs: multidrawState.configs.toSpliced(atIdx, 1),
      },
    });
  };
  const toggleMerge = () => {
    updateState((prev) => ({
      multiDraws: {
        merge: !prev.multiDraws?.merge,
        configs: prev.multiDraws?.configs || [],
      },
    }));
  };

  const configs = multidrawState?.configs.map((configId, idx) => (
    <Group key={configId} gap={4} my={4} wrap="nowrap">
      <ConfigSelect
        selectedId={configId}
        onChange={(newConfig) => changeConfigAtIdx(newConfig, idx)}
      />
      <ActionIcon
        variant="default"
        size={36}
        onClick={() => rmConfigAtIdx(idx)}
        aria-label="Remove extra draw"
      >
        <IconTrash size={16} />
      </ActionIcon>
    </Group>
  ));

  return (
    <div style={{ marginBottom: "1em" }}>
      <Button
        variant="default"
        onClick={toggleCollapse}
        rightSection={
          collapseOpen ? (
            <IconCaretDown size={16} />
          ) : (
            <IconCaretRight size={16} />
          )
        }
      >
        {multidrawState?.configs.length
          ? `${multidrawState.configs.length} `
          : null}
        Extra Draws
      </Button>
      <Collapse expanded={collapseOpen}>
        <Card withBorder my="xs">
          <Switch
            label="Merge all draws into one set"
            checked={multidrawState?.merge}
            onChange={toggleMerge}
          />
          <Input.Wrapper
            label={multidrawState?.merge ? "Extra Draws" : "Extra Sets"}
            mt="sm"
          >
            {configs}
            <div>
              <Button variant="default" mt={4} onClick={addExtraDraw}>
                Add extra {multidrawState?.merge ? "Draw" : "Set"}
              </Button>
            </div>
          </Input.Wrapper>
        </Card>
      </Collapse>
    </div>
  );
}
