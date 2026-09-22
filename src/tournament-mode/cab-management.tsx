import {
  ActionIcon,
  Card,
  Group,
  Menu,
  Text,
  TextInput,
  Tooltip,
} from "@mantine/core";
import { useAppDispatch, useAppState } from "../state/store";
import React, { ReactNode, useCallback, useState } from "react";
import { CabInfo, eventSlice } from "../state/event.slice";
import {
  IconPlus,
  IconCaretLeft,
  IconCaretRight,
  IconX,
  IconVideo,
  IconDots,
  IconCircleMinus,
} from "@tabler/icons-react";
import { detectedLanguage } from "../utils";
import { useSetAtom } from "jotai";
import { mainTabAtom } from "./main-view";
import { drawingsSlice } from "../state/drawings.slice";
import { playerDisplayName } from "../models/Drawing";
import { useHref, useNavigate } from "react-router-dom";
import { routableCabDashboardPath } from "./copy-obs-source";

export function CabManagement() {
  const [isCollapsed, setCollapsed] = useState(true);
  const cabs = useAppState(eventSlice.selectors.allCabs);

  if (isCollapsed) {
    return (
      <div style={{ width: "40px", paddingTop: "1em" }}>
        <Tooltip label="Show cabs">
          <ActionIcon
            variant="subtle"
            color="gray"
            onClick={() => setCollapsed(false)}
            aria-label="Show cabs"
          >
            <IconCaretRight size={18} />
          </ActionIcon>
        </Tooltip>
      </div>
    );
  }

  return (
    <div style={{ padding: "1em", overflow: "auto" }}>
      <div>
        <AddCabControl>
          <Tooltip label="Hide cabs">
            <ActionIcon
              variant="subtle"
              color="gray"
              size={36}
              onClick={() => setCollapsed(true)}
              aria-label="Hide cabs"
            >
              <IconCaretLeft size={18} />
            </ActionIcon>
          </Tooltip>
        </AddCabControl>
      </div>
      <div>
        {cabs.map((cab) => (
          <CabSummary key={cab.id} cab={cab} />
        ))}
      </div>
    </div>
  );
}

function AddCabControl(props: { children?: ReactNode }) {
  const [name, setName] = useState("");
  const dispatch = useAppDispatch();
  const addCab = useCallback(() => {
    dispatch(eventSlice.actions.addCab(name));
    setName("");
  }, [dispatch, name]);
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        addCab();
      }}
    >
      <Group gap={4} wrap="nowrap">
        <TextInput
          value={name}
          onChange={(e) => setName(e.currentTarget.value)}
          placeholder="Cab name"
        />
        <ActionIcon
          variant="default"
          size={36}
          onClick={addCab}
          aria-label="Add cab"
        >
          <IconPlus size={16} />
        </ActionIcon>
        {props.children}
      </Group>
    </form>
  );
}

function CabSummary({ cab }: { cab: CabInfo }) {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const dashPath = routableCabDashboardPath(cab.id);
  const dashHref = useHref(dashPath, { relative: "route" });
  const removeCab = useCallback(
    () => dispatch(eventSlice.actions.removeCab(cab.id)),
    [dispatch, cab.id],
  );

  return (
    <div id={cab.id}>
      <h1>
        {cab.name}{" "}
        <Menu>
          <Menu.Target>
            <ActionIcon variant="subtle" color="gray" aria-label="Cab actions">
              <IconDots size={16} />
            </ActionIcon>
          </Menu.Target>
          <Menu.Dropdown>
            <Menu.Item
              leftSection={<IconVideo size={16} />}
              rightSection={
                <Text size="xs" c="dimmed">
                  dashboard
                </Text>
              }
              component="a"
              href={dashHref}
              onClick={(e) => {
                e.preventDefault();
                navigate(dashPath);
              }}
            >
              OBS Sources
            </Menu.Item>
            <Menu.Item
              leftSection={<IconCircleMinus size={16} />}
              onClick={removeCab}
            >
              Remove Cab
            </Menu.Item>
          </Menu.Dropdown>
        </Menu>{" "}
      </h1>
      <CurrentMatch cab={cab} />
    </div>
  );
}

const listFormatter = new Intl.ListFormat(detectedLanguage, {
  style: "short",
  type: "unit",
});

function CurrentMatch(props: { cab: CabInfo }) {
  const dispatch = useAppDispatch();
  const removeCab = useCallback(
    () => dispatch(eventSlice.actions.clearCabAssignment(props.cab.id)),
    [dispatch, props.cab.id],
  );
  const drawing = useAppState((s) => {
    if (!props.cab.activeMatch) return null;
    if (typeof props.cab.activeMatch === "string") {
      return s.drawings.entities[props.cab.activeMatch];
    }
    return drawingsSlice.selectors.selectMergedByCompoundId(
      s,
      props.cab.activeMatch,
    );
  });
  const setMainTab = useSetAtom(mainTabAtom);

  const scrollToDrawing = useCallback(() => {
    if (!drawing) {
      return;
    }
    const el = document.getElementById(`drawing:${drawing.id}`);
    if (!el) {
      return;
    }
    const priorFocus = document.querySelector(
      "[data-focused]",
    ) as HTMLElement | null;
    if (priorFocus) {
      delete priorFocus.dataset.focused;
    }
    setMainTab("drawings");
    el.scrollIntoView({ behavior: "smooth" });
    el.dataset.focused = "";
  }, [drawing, setMainTab]);

  if (!drawing) {
    return <p>No match</p>;
  }
  const filledPlayers = drawing.meta.players.map(playerDisplayName);
  const assignmentType =
    typeof props.cab.activeMatch === "string" ? "match" : "set";
  return (
    <Card
      withBorder
      shadow="md"
      padding="sm"
      style={{ position: "relative", cursor: "pointer" }}
      onClick={scrollToDrawing}
    >
      <ActionIcon
        variant="subtle"
        color="gray"
        size="sm"
        style={{ position: "absolute", right: "0.5em", top: "0.5em" }}
        onClick={(e) => {
          e.stopPropagation();
          removeCab();
        }}
        aria-label="Clear assignment"
      >
        <IconX size={14} />
      </ActionIcon>
      <h3>
        {drawing.meta.title} ({assignmentType})
      </h3>
      <p>{listFormatter.format(filledPlayers)}</p>
    </Card>
  );
}
