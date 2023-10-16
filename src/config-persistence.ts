import { ConfigState, useConfigState } from "./config-state";
import { useDrawState } from "./draw-state";
import { toaster } from "./toaster";
import { shareData } from "./utils/share";

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
 * Strips mutations from an object, and converts sets to arrays
 */
type Serialized<T extends object> = {
  [K in NonFunctionKeys<T>]: T[K] extends ReadonlySet<infer Item>
    ? Array<Item>
    : T[K];
};

export function saveConfig() {
  const persistedObj = buildPersistedConfig();
  const dataUri = `data:application/json,${encodeURI(
    JSON.stringify(persistedObj, undefined, 2),
  )}`;
  return shareData(dataUri, {
    filename: `card-draw-config-${persistedObj.dataSetName}.json`,
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

function buildPersistedConfig(): PersistedConfigV1 {
  const { ...configState } = useConfigState.getState();
  const serializedState: PersistedConfigV1["configState"] = {
    ...configState,
    difficulties: Array.from(configState.difficulties),
    flags: Array.from(configState.flags),
  };
  const ret: PersistedConfigV1 = {
    version: 1,
    dataSetName: useDrawState.getState().dataSetName,
    configState: serializedState,
  };
  return ret;
}

async function loadPersistedConfig(saved: PersistedConfigV1) {
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

  useConfigState.setState({
    ...migrateOldNames(saved.configState),
    difficulties: new Set(saved.configState.difficulties),
    flags: new Set(saved.configState.flags),
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

  if (showPool) {
    modernConfig.showEligibleCharts = showPool;
  }

  if (showLabels) {
    modernConfig.showPlayerAndRoundLabels = showLabels;
  }

  return modernConfig;
}
