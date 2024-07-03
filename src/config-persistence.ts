import { getDefaultStore } from "jotai";
import {
  ConfigState,
  showEligibleCharts,
  showPlayerAndRoundLabels,
} from "./config-state";
import { useDrawState } from "./draw-state";
import { Roomstate } from "./party/types";
import { store } from "./state/store";
import { toaster } from "./toaster";
import { buildDataUri, dateForFilename, shareData } from "./utils/share";

/** Mark specific fields in T optional, keeping others unchanged */
type Optional<T, Fields extends keyof T> = Partial<Pick<T, Fields>> &
  Omit<T, Fields>;

interface PersistedConfigV1 {
  version: 1;
  dataSetName: string;
  configState: Serialized<ConfigState> & OldSettings;
}

/**
 * Returns a union of all property names in T which do not contain a function value.
 * Allows us to filter out mutations from a zustand store state.
 */
type NonFunctionKeys<T extends object> = keyof {
  // eslint-disable-next-line @typescript-eslint/ban-types
  [K in keyof T as T[K] extends Function ? never : K]: T[K];
};

/**
 * Strips mutations from an object, and converts sets to arrays, maps to arrays of entry pairs
 */
export type Serialized<T extends object> = {
  [K in NonFunctionKeys<T>]: T[K] extends ReadonlyMap<infer K, infer V>
    ? Array<[K, V]>
    : T[K] extends ReadonlySet<infer Item>
      ? Array<Item>
      : T[K];
};

export function saveConfig() {
  const persistedObj = buildPersistedConfig(store.getState().config);
  const dataUri = buildDataUri(
    JSON.stringify(persistedObj, undefined, 2),
    "application/json",
    "url",
  );

  return shareData(dataUri, {
    filename: `ddr-tools-config-${persistedObj.dataSetName}-${dateForFilename()}.json`,
    methods: [
      { type: "nativeShare", allowDesktop: true },
      { type: "download" },
    ],
  });
}

export function loadConfig() {
  const fileInput = document.createElement("input");
  fileInput.type = "file";
  fileInput.accept = ".json,application/json";
  fileInput.style.visibility = "hidden";
  document.body.appendChild(fileInput);
  const resolution = new Promise<void>((resolve, reject) => {
    async function changeHandler() {
      try {
        const files = fileInput.files;
        if (!files) {
          reject();
          throw new Error("no file selected");
        }
        const f = files.item(0);
        if (!f) {
          reject();
          throw new Error("no file selected");
        }
        if (f.type !== "application/json") {
          reject();
          throw new Error("file type is " + f.type);
        }
        const contents: PersistedConfigV1 = JSON.parse(await f.text());
        await loadPersistedConfig(contents);
        resolve();
        toaster.show({
          message: "Successfully loaded draw settings",
          icon: "import",
          intent: "success",
        });
      } catch (e) {
        toaster.show({
          message: "Failed to load settings file",
          icon: "error",
          intent: "danger",
        });
        console.error("Settings load message: ", (e as Error).message);
      } finally {
        fileInput.removeEventListener("change", changeHandler);
        document.body.removeChild(fileInput);
      }
    }
    fileInput.addEventListener("change", changeHandler);
  });
  fileInput.click();
  return resolution;
}

export function serializeConfig(cfg: ConfigState): Serialized<ConfigState> {
  return {
    ...cfg,
    difficulties: Array.from(cfg.difficulties),
    flags: Array.from(cfg.flags),
    folders: Array.from(cfg.folders),
  };
}

function buildPersistedConfig(cfg: ConfigState): PersistedConfigV1 {
  const serializedState = serializeConfig(cfg);
  const ret: PersistedConfigV1 = {
    version: 1,
    dataSetName: useDrawState.getState().dataSetName,
    configState: serializedState,
  };
  return ret;
}

export async function loadFromRoomstate(roomstate: Roomstate) {
  await loadPersistedConfig({
    version: 1,
    dataSetName: roomstate.dataSetName || useDrawState.getState().dataSetName,
    configState: roomstate.config,
  });
  useDrawState.setState({ drawings: roomstate.drawings });
}

async function loadPersistedConfig(
  saved: Optional<PersistedConfigV1, "configState">,
) {
  if (saved.version !== 1) {
    return false;
  }
  const drawState = useDrawState.getState();
  if (drawState.dataSetName !== saved.dataSetName) {
    const nextConfigChange = new Promise<void>((resolve) => {
      const unsub = useConfigState.subscribe(() => {
        unsub();
        resolve();
      });
    });
    await drawState.loadGameData(saved.dataSetName);
    // the ApplyDefaultConfig component will kick in
    // to overwrite config in response to this change
    // so we have to wait for that to happen before continuing
    await nextConfigChange;
  }

  if (saved.configState) {
    applySerializedConfig(saved.configState);
  }
}

export function applySerializedConfig(config: Serialized<ConfigState>) {
  useConfigState.setState({
    ...migrateOldNames(config),
    difficulties: new Set(config.difficulties),
    flags: new Set(config.flags),
    folders: new Set(config.folders),
  });
}

interface OldSettings {
  /** renamed to `showEligibleCharts` */
  showPool?: boolean;
  /** renamed to `showPlayerAndRoundLabels` */
  showLabels?: boolean;
}

function migrateOldNames(
  config: PersistedConfigV1["configState"],
): Serialized<ConfigState> {
  const { showPool, showLabels, ...modernConfig } = config;

  const jotaiStore = getDefaultStore();
  if (showPool) {
    jotaiStore.set(showEligibleCharts, showPool);
  }

  if (showLabels) {
    jotaiStore.set(showPlayerAndRoundLabels, showLabels);
  }

  const maybeOldWeights = modernConfig.weights as unknown as
    | Array<[number, number]>
    | Array<number | undefined>;
  if (Array.isArray(maybeOldWeights[0])) {
    modernConfig.weights = maybeOldWeights.map((pair) =>
      Array.isArray(pair) ? pair[1] : pair,
    );
  }

  return modernConfig;
}
