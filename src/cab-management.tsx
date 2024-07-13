import { Button, Card, ControlGroup, InputGroup } from "@blueprintjs/core";
import { useAppDispatch, useAppState } from "./state/store";
import { useCallback, useState } from "react";
import { CabInfo, eventSlice } from "./state/event.slice";
import { Add, Cross, Remove } from "@blueprintjs/icons";
import { detectedLanguage } from "./utils";

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
        <Button onClick={addCab}>
          <Add />
        </Button>
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
  return (
    <div id={cab.id}>
      <h1>
        {cab.name} <Button minimal icon={<Remove />} onClick={removeCab} />
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
