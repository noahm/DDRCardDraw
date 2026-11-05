import { createTheme, rem, type MantineColorsTuple } from "@mantine/core";

/*
 * A light pass over Mantine's defaults toward the Blueprint look this app wore
 * for years, so the move doesn't read as a different tool. Not a recreation:
 * only the handful of values that set the overall feel (size, weight, color)
 * are tuned, and every component keeps Mantine's own styling otherwise.
 *
 * Palettes put Blueprint's own five shades of each hue at the indices Mantine
 * reaches for (6 filled, 7 hover, 5 and 4 for dark-mode light variants), with
 * only the pale tints at 0-2 and the deepest shade at 9 interpolated.
 */

// Blueprint blue1-5 (#184a90 #215db0 #2d72d2 #4c90f0 #8abbff)
const blue: MantineColorsTuple = [
  "#edf5ff",
  "#d6e7ff",
  "#b3d3ff",
  "#8abbff",
  "#6ba6f8",
  "#4c90f0",
  "#2d72d2",
  "#215db0",
  "#184a90",
  "#113465",
];

// Blueprint green1-5, the success intent
const green: MantineColorsTuple = [
  "#eaf7f0",
  "#ceecdc",
  "#a3ddbe",
  "#72ca9b",
  "#52b781",
  "#32a467",
  "#238551",
  "#1c6e42",
  "#165a36",
  "#0f3f26",
];

// Blueprint red1-5, the danger intent
const red: MantineColorsTuple = [
  "#fef0f0",
  "#fddbdc",
  "#fcbdbf",
  "#fa999c",
  "#f08285",
  "#e76a6e",
  "#cd4246",
  "#ac2f33",
  "#8e292c",
  "#631d1f",
];

/*
 * Blueprint's dark grays carry a slight blue, where Mantine's are neutral. In
 * Mantine's terms: 0 is text, 2 dimmed text, 3 placeholders, 4 borders, 5
 * hovers, 6 inputs and cards, 7 the body and dialogs.
 */
const dark: MantineColorsTuple = [
  "#f6f7f9", // light-gray5, Blueprint's dark-theme text
  "#d3d8de", // light-gray1
  "#abb3bf", // gray4, Blueprint's dark-theme muted text
  "#8f99a8", // gray3
  "#404854", // dark-gray5
  "#383e47", // dark-gray4
  "#2f343c", // dark-gray3
  "#252a31", // dark-gray2
  "#1c2127", // dark-gray1
  "#111418", // black
];

export const theme = createTheme({
  /*
   * Mantine sizes everything off a 16px base where Blueprint used 14px. Scaling
   * by 14/16 brings text, control heights and spacing back to the density the
   * app had, in one value, without touching any component.
   */
  scale: 0.875,
  /*
   * Mantine sets control and label text one step under body text, so the scale
   * alone leaves them at 12px; Blueprint used body size for those and 12px only
   * for small text. Moving the two smallest steps up one restores both.
   */
  fontSizes: { xs: rem(14), sm: rem(16) },
  // Blueprint set 1.28581 everywhere; Mantine's 1.55 reads as a lot of air
  lineHeights: { xs: "1.3", sm: "1.3", md: "1.3" },
  // labels, buttons and tabs were regular weight under Blueprint
  fontWeights: { medium: "400" },
  // 4px corners, as Blueprint's; Mantine 9 defaults to 8px
  defaultRadius: "sm",
  primaryColor: "blue",
  // Blueprint used the same shade of an intent in both themes
  primaryShade: 6,
  colors: { blue, green, red, dark },
});
