import {
  Button,
  Card,
  ControlGroup,
  InputGroup,
  Menu,
  MenuItem,
  Popover,
} from "@blueprintjs/core";
import { useAppDispatch, useAppState } from "./state/store";
import React, { useCallback, useState } from "react";
import { CabInfo, eventSlice } from "./state/event.slice";
import {
  Add,
  Cross,
  Font,
  Layers,
  MobileVideo,
  More,
  Person,
  Remove,
} from "@blueprintjs/icons";
import { detectedLanguage } from "./utils";
import { copyPlainTextToClipboard } from "./utils/share";
import { useSetAtom } from "jotai";
import { mainTabAtom } from "./main-view";

export function CabManagement() {
  const cabs = Object.values(useAppState((s) => s.event.cabs));
  return (
    <div style={{ padding: "1em" }}>
      <div>
        <AddCabControl />
      </div>
      <div>
        {cabs.map((cab) => (
          <CabSummary key={cab.id} cab={cab} />
        ))}
      </div>
    </div>
  );
}

function AddCabControl() {
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
      </ControlGroup>
    </form>
  );
}

function CabSummary({ cab }: { cab: CabInfo }) {
  const dispatch = useAppDispatch();
  const removeCab = useCallback(
    () => dispatch(eventSlice.actions.removeCab(cab.id)),
    [dispatch, cab.id],
  );

  const copySource = useCallback(
    (e: React.MouseEvent<HTMLAnchorElement, MouseEvent>) => {
      const sourceType = e.currentTarget.dataset.source;
      if (sourceType) {
        const sourcePath = `${window.location.pathname}/cab/${cab.id}/source/${sourceType}`;
        const sourceUrl = new URL(sourcePath, window.location.href);
        console.info("Coyping source URL", sourceUrl.href);
        copyPlainTextToClipboard(
          sourceUrl.href,
          "Copied OBS source URL to clipboard",
        );
      }
    },
    [cab],
  );

  const sourcesMenu = (
    <Menu>
      <MenuItem icon={<MobileVideo />} text="OBS Sources">
        <MenuItem
          icon={<Layers />}
          text="Cards"
          onClick={copySource}
          data-source="cards"
        />
        <MenuItem
          icon={<Font />}
          text="Title"
          onClick={copySource}
          data-source="title"
        />
        <MenuItem
          icon={<Person />}
          text="Player 1"
          onClick={copySource}
          data-source="p1"
        />
        <MenuItem
          icon={<Person />}
          text="Player 2"
          onClick={copySource}
          data-source="p2"
        />
      </MenuItem>

      <MenuItem icon={<Remove />} text="Remove Cab" onClick={removeCab} />
    </Menu>
  );

  return (
    <div id={cab.id}>
      <h1>
        {cab.name}{" "}
        <Popover content={sourcesMenu}>
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
    () =>
      dispatch(
        eventSlice.actions.assignMatchToCab({
          cabId: props.cab.id,
          matchId: null,
        }),
      ),
    [dispatch, props.cab.id],
  );
  const drawing = useAppState((s) => {
    if (!props.cab.activeMatch) return null;
    return s.drawings.entities[props.cab.activeMatch] || null;
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
  }, [drawing]);

  if (!drawing) {
    return <p>No match</p>;
  }
  const filledPlayers = drawing.players.map(
    (p, idx) => p || `Player ${idx + 1}`,
  );
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
      <h3>{drawing.title}</h3>
      <p>{listFormatter.format(filledPlayers)}</p>
    </Card>
  );
}