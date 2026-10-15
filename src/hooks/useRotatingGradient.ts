import { useState, type CSSProperties } from "react";
import "./useRotatingGradient.css";

const HUE_STEP = (255 / 8) * 3;
let hue = Math.floor(Math.random() * 255);

function getRandomGradiant() {
  hue += HUE_STEP;
  return `linear-gradient(oklch(var(--drawing-grad-lightness) var(--drawing-grad-chroma) ${hue}), transparent)`;
}

export function useRotatingGradientStyles(): CSSProperties {
  const [backgroundImage] = useState(getRandomGradiant());
  return { backgroundImage };
}
