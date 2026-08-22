import {
  Button,
  Card,
  ControlGroup,
  InputGroup,
  Menu,
  MenuItem,
  Popover,
  Tooltip,
} from "@blueprintjs/core";
import { useAppDispatch, useAppState } from "../state/store";
import React, { ReactNode, useCallback, useState } from "react";
import { CabInfo, eventSlice } from "../state/event.slice";
import {
  Add,
  CaretLeft,
  CaretRight,
  Cross,
  MobileVideo,
  More,
  Remove,
} from "@blueprintjs/icons";
import { detectedLanguage } from "../utils";
import { useSetAtom } from "jotai";
import { mainTabAtom } from "./main-view";
import { drawingsSlice } from "../state/drawings.slice";
import { playerDisplayName } from "../models/Drawing";
import { useHref, useNavigate } from "react-router-dom";

export function CabManagement() {
  const [isCollapsed, setCollapsed] = useState(true);
  const cabs = useAppState(eventSlice.selectors.allCabs);

  if (isCollapsed) {
    return (
      <div style={{ width: "40px", paddingTop: "1em" }}>
        <Tooltip content="Show cabs">
          <Button minimal onClick={() => setCollapsed(false)}>
            <CaretRight />
          </Button>
        </Tooltip>
      </div>
    );
  }

  return (
    <div style={{ padding: "1em", overflow: "auto" }}>
      <div>
        <AddCabControl>
          <Tooltip content="Hide cabs">
            <Button minimal onClick={() => setCollapsed(true)}>
              <CaretLeft />
            </Button>
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
      <ControlGroup>
        <InputGroup
          value={name}
          onChange={(e) => setName(e.currentTarget.value)}
          placeholder="Cab name"
        />
        <Button onClick={addCab} icon={<Add />} />
        {props.children}
      </ControlGroup>
    </form>
  );
}

function CabSummary({ cab }: { cab: CabInfo }) {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const dashHref = useHref("dash", { relative: "route" });
  const removeCab = useCallback(
    () => dispatch(eventSlice.actions.removeCab(cab.id)),
    [dispatch, cab.id],
  );

  const cabMenu = (
    <Menu>
      <MenuItem
        icon={<MobileVideo />}
        text="OBS Sources"
        label="dashboard"
        href={dashHref}
        onClick={(e) => {
          e.preventDefault();
          navigate("dash");
        }}
      />
      <MenuItem icon={<Remove />} text="Remove Cab" onClick={removeCab} />
    </Menu>
  );

  return (
    <div id={cab.id}>
      <h1>
        {cab.name}{" "}
        <Popover content={cabMenu}>
          <Button minimal icon={<More />} />
        </Popover>{" "}
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
      elevation={2}
      style={{ position: "relative" }}
      compact
      interactive
      onClick={scrollToDrawing}
    >
      <Button
        minimal
        small
        icon={<Cross />}
        style={{ position: "absolute", right: "0.5em", top: "0.5em" }}
        onClick={removeCab}
      />
      <h3>
        {drawing.meta.title} ({assignmentType})
      </h3>
      <p>{listFormatter.format(filledPlayers)}</p>
    </Card>
  );
}
