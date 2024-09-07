import { ConfigState } from "./config-state";
import { toaster } from "./toaster";
import { buildDataUri, dateForFilename, shareData } from "./utils/share";

/** Mark specific fields in T optional, keeping others unchanged */
// type Optional<T, Fields extends keyof T> = Partial<Pick<T, Fields>> &
//   Omit<T, Fields>;

interface PersistedConfigV2 {
  version: 2;
  configState: ConfigState;
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

function buildPersistedConfig(config: ConfigState): PersistedConfigV2 {
  return {
    version: 2,
    configState: config,
  };
}

export function saveConfig(config: ConfigState) {
  const persistedObj = buildPersistedConfig(config);
  const dataUri = buildDataUri(
    JSON.stringify(persistedObj, undefined, 2),
    "application/json",
    "url",
  );

  return shareData(dataUri, {
    filename: `ddr-tools-config-${config.name.replaceAll(" ", "-")}-${dateForFilename()}.json`,
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
        // const contents: PersistedConfigV1 = JSON.parse(await f.text());
        // await loadPersistedConfig(contents);
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
