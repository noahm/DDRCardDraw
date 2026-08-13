import { atom, getDefaultStore, useAtomValue, useSetAtom } from "jotai";
import { atomFamily, atomWithStorage } from "jotai/utils";
import { Validator, Schema } from "jsonschema";
import { GameData } from "../models/SongData";
import gameDataSchema from "../models/game-data.schema.json";
import { useEffect } from "react";
import { useRoomName } from "../hooks/useRoomName";

const lastGameSelectedByEvent = atomFamily((roomName: string) =>
  atomWithStorage<string | undefined>(
    `ddrtools.lastGameSelected:${roomName}`,
    undefined,
    undefined,
    { getOnInit: true },
  ),
);

export function useLastGameSelected() {
  const roomName = useRoomName();
  return useAtomValue(lastGameSelectedByEvent(roomName));
}

export function useSetLastGameSelected() {
  const roomName = useRoomName();
  return useSetAtom(lastGameSelectedByEvent(roomName));
}

/** should be the return value from `useRoomName` */
export function getLastGameSelected(roomName: string) {
  const jotaiStore = getDefaultStore();
  return jotaiStore.get(lastGameSelectedByEvent(roomName));
}

export const stockDataCache = atom<Record<string, GameData>>({});
export const customDataCache = atom<Record<string, GameData>>({});

/**
 * Whether the "create custom data" dialog is open. Global so it can be opened
 * from anywhere — the hamburger menu, the game-data picker's "Create custom
 * data…" item, or a folder drop.
 */
export const customDataDialogOpen = atom(false);

/**
 * A folder dropped onto the window, waiting to be picked up by the custom-data
 * dialog. Dropping a folder is unambiguous, so it skips the dialog's source
 * chooser and opens the ITG pack form directly on this item.
 */
export const pendingPackDrop = atom<DataTransferItem | null>(null);

export const stockDataByName = atomFamily((name: string) =>
  atom((get) => get(stockDataCache)[name]),
);

/** Custom (URL-keyed) data resolved from a published bundle, e.g. data.ddr.tools. */
export const customDataByUrl = atomFamily((url: string) =>
  atom((get) => get(customDataCache)[url]),
);

/** A `gameKey` is a URL target (a published bundle) iff it starts with http(s). */
export function isUrlGameKey(key: string): boolean {
  return /^https?:\/\//.test(key);
}

export async function loadStockGamedataByName(name: string) {
  const jotaiStore = getDefaultStore();
  const cache = jotaiStore.get(stockDataCache);
  if (cache[name]) {
    return cache[name];
  }

  try {
    const data = (
      await import(/* webpackChunkName: "songData" */ `../songs/${name}.json`)
    ).default as GameData;
    jotaiStore.set(stockDataCache, (prev) => {
      return {
        ...prev,
        [name]: data,
      };
    });
    return data;
  } catch {
    console.warn(`failed to load song data with key '${name}'`);
  }
}

const gameDataValidator = new Validator();

/**
 * Resolve a `gameKey` that is an http(s) URL to a published, immutable bundle:
 * fetch it, validate against the canonical Game Data schema, and cache it in
 * `customDataCache` keyed by URL (safe to cache forever — bundles are immutable).
 * Returns undefined (and logs) on fetch/validation failure rather than throwing,
 * matching `loadStockGamedataByName`.
 */
export async function loadCustomGamedataByUrl(
  url: string,
): Promise<GameData | undefined> {
  const jotaiStore = getDefaultStore();
  const cache = jotaiStore.get(customDataCache);
  if (cache[url]) {
    return cache[url];
  }

  try {
    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(`request failed with status ${res.status}`);
    }
    const data = (await res.json()) as GameData;
    const result = gameDataValidator.validate(data, gameDataSchema as Schema, {
      nestedErrors: true,
    });
    if (!result.valid) {
      console.warn(
        `bundle at '${url}' failed schema validation`,
        result.errors.slice(0, 5).map((e) => `${e.property} ${e.message}`),
      );
      return undefined;
    }
    jotaiStore.set(customDataCache, (prev) => {
      return {
        ...prev,
        [url]: data,
      };
    });
    return data;
  } catch (e) {
    console.warn(`failed to load custom song data from '${url}'`, e);
  }
}

/**
 * Resolve any `gameKey` to its GameData: an http(s) URL goes through the custom
 * bundle loader, anything else through the bundled stock loader. This is the
 * single seam that makes a URL target drawable (incl. in synced rooms).
 */
export async function loadGamedataByKey(
  key: string,
): Promise<GameData | undefined> {
  if (isUrlGameKey(key)) {
    return loadCustomGamedataByUrl(key);
  }
  return loadStockGamedataByName(key);
}

export function useGameDataForKey(key: string): GameData | null {
  const isUrl = isUrlGameKey(key);
  const stock = useAtomValue(stockDataByName(key));
  const custom = useAtomValue(customDataByUrl(key));
  const data = isUrl ? custom : stock;
  useEffect(() => {
    if (!data && key) {
      void loadGamedataByKey(key);
    }
  }, [data, key]);
  return data || null;
}

export function useStockGameData(name: string): GameData | null {
  const data = useAtomValue(stockDataByName(name));
  useEffect(() => {
    if (!data && name) {
      void loadStockGamedataByName(name);
    }
  }, [data, name]);
  return data || null;
}
