import { atom, getDefaultStore, useAtomValue, useSetAtom } from "jotai";
import { atomFamily, atomWithStorage } from "jotai/utils";
import { Validator, Schema } from "jsonschema";
import { GameData } from "../models/SongData";
// identical to the hosted data.ddr.tools/schema/v2.json
import gameDataSchema from "../../songs.schema.json";
import { useEffect } from "react";
import { useRoomName } from "../hooks/useRoomName";
import { withLegacyJacketUrls } from "../utils/jackets";
import { upgradeLegacyGameData } from "../utils/legacy-game-data";

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
 * Something dropped onto the window, waiting to be picked up by the custom-data
 * dialog: either an ITG pack (folder or `.zip`) or a premade GameData `.json`
 * file. Either is unambiguous, so it skips the dialog's source chooser and opens
 * the matching form directly on it.
 */
export type PendingDrop =
  | { kind: "pack"; item: DataTransferItem }
  | { kind: "json"; file: File };
export const pendingDrop = atom<PendingDrop | null>(null);

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

/** Schema versions hosted by data.ddr.tools, which a data file may declare. */
const HOSTED_SCHEMA_URL = /^https:\/\/data\.ddr\.tools\/schema\/[\w.-]+\.json$/;
const hostedSchemas = new Map<string, Promise<Schema>>();

/**
 * The hosted schema a data file declares, when it's one other than the schema
 * bundled with this build.
 */
function declaredHostedSchema(data: unknown): string | undefined {
  const declared = (data as { $schema?: unknown } | null)?.$schema;
  if (
    typeof declared !== "string" ||
    declared === gameDataSchema.$id ||
    !HOSTED_SCHEMA_URL.test(declared)
  ) {
    return undefined;
  }
  return declared;
}

/**
 * The schema to hold a data file to. A file declaring a schema hosted on
 * data.ddr.tools is checked against that one, fetched live, so data written for
 * a schema newer than this build (e.g. v2's `song.id`) is still accepted.
 * Anything else — no `$schema`, a relative path like stock data's, or any other
 * host — gets the bundled schema. The publish Worker validates again on upload,
 * so this is never the only check.
 */
function schemaForData(data: unknown): Promise<Schema> {
  const declared = declaredHostedSchema(data);
  if (!declared) {
    return Promise.resolve(gameDataSchema as Schema);
  }
  let schema = hostedSchemas.get(declared);
  if (!schema) {
    schema = fetch(declared).then((res) => {
      if (!res.ok) {
        throw new Error(
          `couldn't load schema '${declared}' (HTTP ${res.status})`,
        );
      }
      return res.json() as Promise<Schema>;
    });
    // forget a failed fetch so the next attempt retries it
    schema.catch(() => hostedSchemas.delete(declared));
    hostedSchemas.set(declared, schema);
  }
  return schema;
}

/**
 * Check arbitrary parsed JSON against the Game Data schema it declares (see
 * `schemaForData`). Returns a handful of human-readable problems, or an empty
 * list if it's valid. Rejects if a declared hosted schema can't be fetched.
 */
export async function validateGameData(data: unknown): Promise<string[]> {
  const schema = await schemaForData(data);
  const result = gameDataValidator.validate(data, schema, {
    nestedErrors: true,
  });
  return result.errors.slice(0, 5).map((e) => `${e.property} ${e.message}`);
}

/**
 * Resolve a `gameKey` that is an http(s) URL to a published, immutable bundle:
 * fetch it, validate against the Game Data schema it declares, and cache it in
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
    // Bundles from before schema v2 have no `song.id`. One checked against the
    // bundled (v2) schema needs it added first; one declaring an older hosted
    // schema is checked as published, since v1 forbids the `id` it would add.
    const upgradeFirst = !declaredHostedSchema(data);
    if (upgradeFirst) {
      upgradeLegacyGameData(data);
    }
    const errors = await validateGameData(data);
    if (errors.length) {
      console.warn(`bundle at '${url}' failed schema validation`, errors);
      return undefined;
    }
    if (!upgradeFirst) {
      upgradeLegacyGameData(data);
    }
    withLegacyJacketUrls(data);
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
