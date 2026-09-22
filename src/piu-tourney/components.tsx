import {
  ActionIcon,
  Alert,
  Anchor,
  Button,
  Text,
  TextInput,
} from "@mantine/core";
import { IconEdit } from "@tabler/icons-react";
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
      <Alert color="yellow">
        {t(
          "piuTourney.notConfigured",
          undefined,
          "This build has no tourney maker credentials. Set PIU_TOURNEY_SUPABASE_URL and PIU_TOURNEY_SUPABASE_ANON_KEY and rebuild.",
        )}
      </Alert>
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
  const { t, formatMessage } = useIntl();
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
  if (tourneyId && tourney.error) {
    status = (
      <Alert color="red">
        {t("piuTourney.loadFailed", undefined, "Couldn't load that tournament")}
        : {tourney.error}
      </Alert>
    );
  } else if (tourney.data) {
    status = (
      <Alert color="green">
        {tourney.data.name}
        {tourney.data.events?.name ? ` — ${tourney.data.events.name}` : ""}
      </Alert>
    );
  }

  return (
    <form onSubmit={save}>
      <Text component="p">
        {formatMessage(
          {
            id: "piuTourney.explainer",
          },
          {
            piuTmLink: (
              <Anchor href="https://piu-tourney-maker.vercel.app/">
                piu-tourney-maker
              </Anchor>
            ),
          },
        )}
      </Text>
      <TextInput
        label={t("piuTourney.idLabel")}
        mb="sm"
        defaultValue={tourneyId ? String(tourneyId) : undefined}
        ref={inputRef}
        error={parseError}
        placeholder="https://piu-tourney-maker.vercel.app/tourney/123"
        onChange={() => setParseError(null)}
        rightSectionWidth={70}
        rightSection={
          <Button type="submit" size="compact-sm" variant="light">
            {t("piuTourney.save", undefined, "Save")}
          </Button>
        }
      />
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
      <ActionIcon
        variant="subtle"
        color="gray"
        aria-label={changeLabel}
        title={changeLabel}
        onClick={() => setTourneyId(null)}
      >
        <IconEdit size={16} />
      </ActionIcon>
      {props.rightElement && (
        <div style={{ marginLeft: "auto" }}>{props.rightElement}</div>
      )}
    </div>
  );
}
