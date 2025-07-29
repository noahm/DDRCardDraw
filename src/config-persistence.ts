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

export function loadConfig(): Promise<ConfigState> {
  const fileInput = document.createElement("input");
  fileInput.type = "file";
  fileInput.accept = ".json,application/json";
  fileInput.style.visibility = "hidden";
  document.body.appendChild(fileInput);
  const resolution = new Promise<ConfigState>((resolve, reject) => {
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
        const contents: PersistedConfigV2 = JSON.parse(await f.text());
        if (contents.version !== 2) {
          throw new Error("config version was not expected value");
        }
        resolve(contents.configState);
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
