import { OverlayToaster } from "@blueprintjs/core";

export let toaster: OverlayToaster;

export function ToasterHost() {
  return (
    <OverlayToaster
      position="bottom"
      ref={(instance) => {
        toaster = instance!;
      }}
    />
  );
}
