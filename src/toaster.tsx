import { OverlayToaster } from "@blueprintjs/core";
import { createRoot } from "react-dom/client";

export let toaster: OverlayToaster;

const toasterRoot = document.createElement("div");
document.body.appendChild(toasterRoot);
createRoot(toasterRoot).render(
  <OverlayToaster
    position="bottom"
    ref={(instance) => {
      toaster = instance!;
    }}
  />
);
