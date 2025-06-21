import { useState, type CSSProperties } from "react";

const HUE_STEP = (255 / 8) * 3;
let hue = Math.floor(Math.random() * 255);

function getRandomGradiant() {
  hue += HUE_STEP;
  return `linear-gradient(hsl(${hue}, var(--drawing-grad-saturation), var(--drawing-grad-lightness)), transparent, transparent)`;
}

export function useRotatingGradientStyles(): CSSProperties {
  const [backgroundImage] = useState(getRandomGradiant());
  return { backgroundImage };
}
