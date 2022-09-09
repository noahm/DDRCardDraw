import { Toaster } from "@blueprintjs/core";
import { createRoot } from "react-dom/client";

export let toaster: Toaster;

const toasterRoot = document.createElement("div");
document.body.appendChild(toasterRoot);
createRoot(toasterRoot).render(
  <Toaster
    position="bottom"
    ref={(instance) => {
      toaster = instance!;
    }}
  />
);
