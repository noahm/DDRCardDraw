import { Button, Callout, InputGroup, Label, Text } from "@blueprintjs/core";
import { Edit } from "@blueprintjs/icons";
import { useAtom } from "jotai";
import React, { ReactNode, useCallback, useRef, useState } from "react";
import { useIntl } from "../hooks/useIntl";
import { piuClient } from "./client";
import { parseTourneyId, piuTourneyIdAtom, usePiuTourney } from ".";

/**
 * Renders children once a tournament is selected, and the selector otherwise.
 * Mirrors StartggApiKeyGated, but there are no user-supplied credentials here —
 * the anon key is baked in at build time and the data is world readable.
 */
export function PiuTourneyGated(props: { children: ReactNode }) {
  const { t } = useIntl();
  const [tourneyId] = useAtom(piuTourneyIdAtom);

  if (!piuClient) {
    return (
      <Callout intent="warning">
        {t(
          "piuTourney.notConfigured",
          undefined,
          "This build has no tourney maker credentials. Set PIU_TOURNEY_SUPABASE_URL and PIU_TOURNEY_SUPABASE_ANON_KEY and rebuild.",
        )}
      </Callout>
    );
  }
  if (!tourneyId) {
    return <PiuTourneyPicker />;
  }
  return props.children;
}

/**
 * Accepts a tourney-maker link or bare id, confirms it resolves to a real
 * tournament, and remembers it for this device.
 */
export function PiuTourneyPicker() {
  const { t } = useIntl();
  const [tourneyId, setTourneyId] = useAtom(piuTourneyIdAtom);
  const [parseError, setParseError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [tourney] = usePiuTourney(tourneyId);

  const save = useCallback(
    (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      if (!inputRef.current) return;
      const parsed = parseTourneyId(inputRef.current.value);
      if (!parsed) {
        setParseError(
          t(
            "piuTourney.badId",
            undefined,
            "Expected a tournament link or a numeric id",
          ),
        );
        return;
      }
      setParseError(null);
      setTourneyId(parsed);
    },
    [setTourneyId, t],
  );

  let status: ReactNode = null;
  if (parseError) {
    status = <Callout intent="danger">{parseError}</Callout>;
  } else if (tourneyId && tourney.error) {
    status = (
      <Callout intent="danger">
        {t("piuTourney.loadFailed", undefined, "Couldn't load that tournament")}
        : {tourney.error}
      </Callout>
    );
  } else if (tourney.data) {
    status = (
      <Callout intent="success">
        {tourney.data.name}
        {tourney.data.events?.name ? ` — ${tourney.data.events.name}` : ""}
      </Callout>
    );
  }

  return (
    <form onSubmit={save}>
      <Text tagName="p">
        {t(
          "piuTourney.explainer",
          undefined,
          "Pick a tournament from piu-tourney-maker to draw its upcoming matches. Read only — nothing is reported back.",
        )}
      </Text>
      <Label>
        {t(
          "piuTourney.idLabel",
          undefined,
          "tournament link or id (in the form of: /tourney/123)",
        )}
        <InputGroup
          defaultValue={tourneyId ? String(tourneyId) : undefined}
          inputRef={inputRef}
          placeholder="https://…/tourney/123"
          rightElement={
            <Button type="submit">
              {t("piuTourney.save", undefined, "Save")}
            </Button>
          }
        />
      </Label>
      {status}
    </form>
  );
}

/**
 * Compact "drawing from X" line shown above the match list, with a pencil to
 * pick a different tournament. `rightElement` is pushed to the far edge of the
 * same row, so a caller's own control shares this line rather than taking
 * another one.
 */
export function PiuTourneyHeader(props: { rightElement?: ReactNode }) {
  const { t } = useIntl();
  const [tourneyId, setTourneyId] = useAtom(piuTourneyIdAtom);
  const [tourney] = usePiuTourney(tourneyId);
  if (!tourneyId) return null;
  // the pencil replaces what used to be a "change" text button, so the label it
  // carried has to survive as the icon's accessible name
  const changeLabel = t("piuTourney.change", undefined, "change");
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: "4px",
        marginBottom: "10px",
      }}
    >
      <strong>{tourney.data?.name || `#${tourneyId}`}</strong>
      <Button
        variant="minimal"
        size="small"
        icon={<Edit />}
        aria-label={changeLabel}
        title={changeLabel}
        onClick={() => setTourneyId(null)}
      />
      {props.rightElement && (
        <div style={{ marginLeft: "auto" }}>{props.rightElement}</div>
      )}
    </div>
  );
}
