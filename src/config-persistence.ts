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

/** Holds one or more configs in a single file, for batch import/export */
interface PersistedConfigsV2 {
  version: 2;
  configStates: ConfigState[];
}

export function saveConfig(config: ConfigState) {
  const persistedObj: PersistedConfigV2 = {
    version: 2,
    configState: config,
  };
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

/** Export several configs into a single file. Falls back to the single-config
 * format when only one config is given, so individual exports stay tidy. */
export function saveConfigs(configs: ConfigState[]) {
  if (configs.length === 1) {
    return saveConfig(configs[0]);
  }
  const persistedObj: PersistedConfigsV2 = {
    version: 2,
    configStates: configs,
  };
  const dataUri = buildDataUri(
    JSON.stringify(persistedObj, undefined, 2),
    "application/json",
    "url",
  );

  return shareData(dataUri, {
    filename: `ddr-tools-configs-${configs.length}-${dateForFilename()}.json`,
    methods: [
      { type: "nativeShare", allowDesktop: true },
      { type: "download" },
    ],
  });
}

/** Load one or more configs from a file. Accepts both the single-config and
 * multi-config file formats, always resolving to an array. */
export function loadConfigs(): Promise<ConfigState[]> {
  const fileInput = document.createElement("input");
  fileInput.type = "file";
  fileInput.accept = ".json,application/json";
  fileInput.style.visibility = "hidden";
  document.body.appendChild(fileInput);
  const resolution = new Promise<ConfigState[]>((resolve, reject) => {
    async function changeHandler() {
      try {
        const files = fileInput.files;
        if (!files) {
          throw new Error("no file selected");
        }
        const f = files.item(0);
        if (!f) {
          throw new Error("no file selected");
        }
        if (f.type !== "application/json") {
          throw new Error("file type is " + f.type);
        }
        const contents: PersistedConfigV2 | PersistedConfigsV2 = JSON.parse(
          await f.text(),
        );
        if (contents.version !== 2) {
          throw new Error("config version was not expected value");
        }
        if (
          "configStates" in contents &&
          Array.isArray(contents.configStates)
        ) {
          resolve(contents.configStates);
        } else if ("configState" in contents && contents.configState) {
          resolve([contents.configState]);
        } else {
          throw new Error("no config data found in file");
        }
      } catch (e) {
        reject();
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
