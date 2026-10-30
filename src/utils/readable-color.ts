/**
 * Difficulty colors come straight from game data, and some are dark enough
 * (SMX wild, Pump HDB, SDVX novice...) to all but vanish as text on a dark
 * backdrop. This keeps a color's hue but mixes it toward white just until it
 * reaches `minContrast` against black, per the WCAG contrast formula. A color
 * already that light comes back untouched, as does anything that isn't a hex
 * color, since custom game data could hand us any css color at all.
 */
export function readableOnDark(color: string, minContrast = 4.5): string {
  const rgb = parseHex(color);
  if (!rgb) {
    return color;
  }
  for (let mix = 0; mix <= 1; mix += 0.05) {
    const mixed = rgb.map((c) => Math.round(c + (255 - c) * mix));
    if (contrastWithBlack(mixed) >= minContrast) {
      return mix ? toHex(mixed) : color;
    }
  }
  return "#ffffff";
}

function parseHex(color: string): number[] | null {
  const match = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(color.trim());
  if (!match) {
    return null;
  }
  const hex =
    match[1].length === 3
      ? Array.from(match[1], (c) => c + c).join("")
      : match[1];
  return [0, 2, 4].map((i) => parseInt(hex.slice(i, i + 2), 16));
}

function toHex(rgb: number[]): string {
  return `#${rgb.map((c) => c.toString(16).padStart(2, "0")).join("")}`;
}

/** WCAG contrast ratio of an sRGB color against pure black */
function contrastWithBlack(rgb: number[]): number {
  const [r, g, b] = rgb.map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return (luminance + 0.05) / 0.05;
}
