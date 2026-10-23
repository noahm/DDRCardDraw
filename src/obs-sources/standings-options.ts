/**
 * What a gauntlet standings source shows, carried in its url for the same
 * reason `./card-options` spells out vetos: an OBS browser source has no
 * settings of its own to read, and two scenes off one cab may want different
 * answers.
 *
 * A url missing either param falls back to that param's default, so a source
 * pasted into OBS before these existed keeps its song columns as they were.
 *
 * Each option carries the key of its label rather than the label, so this
 * stays a plain module the OBS route can import without react-intl.
 */
export const pickerModes = [
  { key: "show", labelKey: "obsDashboard.standingsPickersShow" },
  { key: "hide", labelKey: "obsDashboard.standingsPickersHide" },
] as const;

export type PickerMode = (typeof pickerModes)[number]["key"];

export const songModes = [
  { key: "played", labelKey: "obsDashboard.standingsSongsPlayed" },
  { key: "all", labelKey: "obsDashboard.standingsSongsAll" },
] as const;

export type SongMode = (typeof songModes)[number]["key"];

/** search param saying whether pocket/free picks name who picked them */
export const PICKERS_PARAM = "pickers";
/** search param saying whether songs nobody has scored yet get a column */
export const SONGS_PARAM = "songs";

export const defaultPickerMode: PickerMode = "show";
/** only songs with a score, which is all the source did before this was an option */
export const defaultSongMode: SongMode = "played";

export interface StandingsOptions {
  pickers: PickerMode;
  songs: SongMode;
}

/**
 * Reads a standings source's search params. An unknown value falls back to the
 * default rather than the other mode, so a typo doesn't mean the opposite.
 */
export function toStandingsOptions(params: URLSearchParams): StandingsOptions {
  const pickers = params.get(PICKERS_PARAM);
  const songs = params.get(SONGS_PARAM);
  return {
    pickers:
      pickerModes.find((mode) => mode.key === pickers)?.key ||
      defaultPickerMode,
    songs: songModes.find((mode) => mode.key === songs)?.key || defaultSongMode,
  };
}

/**
 * Path stub for a standings source, e.g. `standings?pickers=show&songs=all`.
 * Always spelled out, even for defaults, so the url says what it does.
 */
export const standingsSourceStub = ({ pickers, songs }: StandingsOptions) =>
  `standings?${new URLSearchParams({ [PICKERS_PARAM]: pickers, [SONGS_PARAM]: songs })}`;
