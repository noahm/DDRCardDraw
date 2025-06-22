import { Button, Card, Collapse, FormGroup, Switch } from "@blueprintjs/core";
import { useConfigState, useUpdateConfig } from "../state/hooks";
import { ConfigSelect } from "./config-select";
import { CaretDown, CaretRight, Trash } from "@blueprintjs/icons";
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
    <div>
      <ConfigSelect
        selectedId={configId}
        onChange={(newConfig) => changeConfigAtIdx(newConfig, idx)}
      />
      <Button icon={<Trash />} onClick={() => rmConfigAtIdx(idx)} />
    </div>
  ));

  return (
    <>
      <Button
        onClick={toggleCollapse}
        endIcon={collapseOpen ? <CaretDown /> : <CaretRight />}
      >
        {multidrawState?.configs.length
          ? `${multidrawState.configs.length} `
          : null}
        Extra Draws
      </Button>
      <Collapse isOpen={collapseOpen}>
        <Card>
          <Switch
            label="Merge all draws into one set"
            checked={multidrawState?.merge}
            onChange={toggleMerge}
          />
          <FormGroup
            style={{ marginBottom: "0" }}
            label={multidrawState?.merge ? "Extra Draws" : "Extra Sets"}
          >
            {configs}
            <Button onClick={addExtraDraw}>
              Add extra {multidrawState?.merge ? "Draw" : "Set"}
            </Button>
          </FormGroup>
        </Card>
      </Collapse>
    </>
  );
}
