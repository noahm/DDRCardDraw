import { Classes, Label, Text } from "@blueprintjs/core";
import { useAtomValue, useAtom } from "jotai";
import { ReactNode, useRef, useCallback } from "react";
import { startggKeyAtom, startggEventSlug } from ".";

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
      if (!apikeyRef.current || !slugRef.current) return;
      setApiKey(apikeyRef.current.value);
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
        <input
          defaultValue={apiKey || undefined}
          ref={apikeyRef}
          className={Classes.INPUT}
          size={40}
        />
      </Label>
      <Label>
        event url slug (in the form of:{" "}
        <pre style={{ display: "inline" }}>
          tournament/SOMETHING/event/SOMETHING
        </pre>
        )
        <input
          defaultValue={eventSlug || undefined}
          ref={slugRef}
          className={Classes.INPUT}
          size={80}
        />
      </Label>
      <button type="submit">Save</button>
    </form>
  );
}
