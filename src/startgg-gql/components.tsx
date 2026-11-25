import { Alert, Button, List, Text, TextInput } from "@mantine/core";
import { useAtomValue, useAtom, useSetAtom } from "jotai";
import React, { ReactNode, useRef, useState, useCallback } from "react";
import { DelayedSpinner } from "../common-components/delayed-spinner";
import {
  startggKeyAtom,
  startggEventSlug,
  parseEventSlug,
  useCurrentUserEvents,
} from ".";

export function StartggApiKeyGated(props: { children: ReactNode }) {
  const apiKey = useAtomValue(startggKeyAtom);
  const eventSlug = useAtomValue(startggEventSlug);
  if (apiKey && eventSlug) {
    return props.children;
  } else {
    return <StartggCredsManager />;
  }
}

export function StartggCredsManager() {
  const [apiKey, setApiKey] = useAtom(startggKeyAtom);
  const [eventSlug, setEventSlug] = useAtom(startggEventSlug);
  const [slugError, setSlugError] = useState<string | null>(null);
  const apikeyRef = useRef<HTMLInputElement>(null);
  const slugRef = useRef<HTMLInputElement>(null);
  const saveKey = useCallback(
    async (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      if (!apikeyRef.current) return;
      // tokens get pasted, and a stray newline makes every request 401
      setApiKey(apikeyRef.current.value.trim());
      if (!slugRef.current) return;
      const raw = slugRef.current.value;
      if (!raw.trim()) {
        // the field is disabled until a key is saved, so a blank slug on the
        // first save is the normal path, not a mistake worth shouting about
        setSlugError(null);
        setEventSlug(null);
        return;
      }
      const slug = parseEventSlug(raw);
      if (!slug) {
        setSlugError(
          "Expected an event address like tournament/SOMETHING/event/SOMETHING",
        );
        return;
      }
      setSlugError(null);
      // show what actually got saved, since a pasted URL loses its origin and
      // any trailing path here
      slugRef.current.value = slug;
      setEventSlug(slug);
    },
    [setApiKey, setEventSlug],
  );
  return (
    <form onSubmit={saveKey}>
      <Text component="p">
        Start.gg credentials are saved locally on this device and never synced
        with other devices
      </Text>
      <TextInput
        label={
          <>
            start.gg api key (
            <a target="_blank" href="https://start.gg/admin/profile/developer">
              create a personal token here
            </a>
            )
          </>
        }
        defaultValue={apiKey || undefined}
        ref={apikeyRef}
        mb="sm"
        rightSectionWidth={70}
        rightSection={
          <Button type="submit" size="compact-sm" variant="light">
            Save
          </Button>
        }
      />
      <TextInput
        label={
          <>
            event url slug (in the form of:{" "}
            <pre style={{ display: "inline" }}>
              tournament/SOMETHING/event/SOMETHING
            </pre>
            ) — pasting the whole event page address works too
          </>
        }
        disabled={!apiKey}
        defaultValue={eventSlug || undefined}
        ref={slugRef}
        mb="sm"
        error={slugError}
        placeholder="https://start.gg/tournament/SOMETHING/event/SOMETHING"
        onChange={() => setSlugError(null)}
        rightSectionWidth={70}
        rightSection={
          <Button type="submit" size="compact-sm" variant="light">
            Save
          </Button>
        }
      />
      {!!apiKey && (
        <EventPicker
          onSelected={(slug) => {
            setSlugError(null);
            if (slugRef.current) {
              slugRef.current.value = slug;
            }
          }}
        />
      )}
    </form>
  );
}

function EventPicker(props: { onSelected(slug: string): void }) {
  const [result] = useCurrentUserEvents();
  const setEventSlug = useSetAtom(startggEventSlug);
  const tournaments = result.data?.currentUser?.tournaments?.nodes;
  const pageInfo = result.data?.currentUser?.tournaments?.pageInfo;

  function handleSelect(e: React.MouseEvent<HTMLAnchorElement>) {
    e.preventDefault();
    const slug = e.currentTarget.dataset.slug;
    if (slug) {
      setEventSlug(slug);
      props.onSelected(slug);
    }
  }

  if (result.error) {
    // an expired or mistyped token lands here, and rendering nothing for it
    // left the picker simply absent with no hint as to why
    return (
      <Alert color="red">
        Couldn't load your tournaments: {result.error.message}
      </Alert>
    );
  }
  if (result.fetching && !tournaments) {
    return <DelayedSpinner />;
  }
  if (!tournaments?.length) {
    return null;
  }
  const total = pageInfo?.total ?? tournaments.length;
  return (
    <>
      <Text component="p">
        Try the easy way and pick from your tournaments:
        {total > tournaments.length && (
          <>
            {" "}
            <Text span c="dimmed" inherit>
              newest {tournaments.length} of {total} — paste the slug above for
              an older one
            </Text>
          </>
        )}
      </Text>
      <List>
        {tournaments.map((t) => {
          if (!t) return null;
          const events = t.events;
          return (
            <List.Item key={t.id!}>
              {t.name}
              {events?.length ? (
                <ul>
                  {events.map((evt) => {
                    if (!evt) return null;
                    return (
                      <li key={evt.id!}>
                        <a href="#" onClick={handleSelect} data-slug={evt.slug}>
                          {evt.name}
                        </a>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                " (no events)"
              )}
            </List.Item>
          );
        })}
      </List>
    </>
  );
}
