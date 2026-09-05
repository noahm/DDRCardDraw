import { Button, Classes, InputGroup, Label, Text } from "@blueprintjs/core";
import { useAtomValue, useAtom, useSetAtom } from "jotai";
import React, { ReactNode, useRef, useCallback } from "react";
import { startggKeyAtom, startggEventSlug, useCurrentUserEvents } from ".";

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
  const apikeyRef = useRef<HTMLInputElement>(null);
  const slugRef = useRef<HTMLInputElement>(null);
  const saveKey = useCallback(
    async (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      if (!apikeyRef.current) return;
      setApiKey(apikeyRef.current.value);
      if (!slugRef.current) return;
      setEventSlug(slugRef.current.value);
    },
    [setApiKey, setEventSlug],
  );
  return (
    <form onSubmit={saveKey}>
      <Text tagName="p">
        Start.gg credentials are saved locally on this device and never synced
        with other devices
      </Text>
      <Label>
        start.gg api key (
        <a target="_blank" href="https://start.gg/admin/profile/developer">
          create a personal token here
        </a>
        ){" "}
        <InputGroup
          defaultValue={apiKey || undefined}
          inputRef={apikeyRef}
          rightElement={<Button type="submit">Save</Button>}
        />
      </Label>
      <Label>
        event url slug (in the form of:{" "}
        <pre style={{ display: "inline" }}>
          tournament/SOMETHING/event/SOMETHING
        </pre>
        )
        <InputGroup
          disabled={!apiKey}
          defaultValue={eventSlug || undefined}
          inputRef={slugRef}
          rightElement={<Button type="submit">Save</Button>}
        />
      </Label>
      {!!apiKey && (
        <EventPicker
          onSelected={(slug) => {
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

  function handleSelect(e: React.MouseEvent<HTMLAnchorElement>) {
    e.preventDefault();
    const slug = e.currentTarget.dataset.slug;
    if (slug) {
      setEventSlug(slug);
      props.onSelected(slug);
    }
  }

  if (!tournaments) {
    return null;
  }
  return (
    <>
      <p>Try the easy way and pick from your tournaments:</p>
      <ul className={Classes.LIST}>
        {tournaments.map((t) => {
          if (!t) return null;
          const events = t.events;
          return (
            <li key={t.id!}>
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
            </li>
          );
        })}
      </ul>
    </>
  );
}
