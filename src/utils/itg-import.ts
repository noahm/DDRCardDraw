import type { PackWithSongs } from "simfile-parser/browser";
import { GameData, Chart, Song } from "../models/SongData";

export function getDataFileFromPack(
  pack: PackWithSongs,
  useTiers = false,
): GameData {
  const someColors: Record<string, string | undefined> = {
    beginner: "#98aafd",
    basic: "#2BC856",
    difficult: "#F2F52C",
    expert: "#F64D8B",
    challenge: "#0191F2",
  };

  const difficulties = new Set<string>();
  const styles = new Set<string>();
  let lvlMax = 0;
  const data: GameData = {
    meta: {
      menuParent: "imported",
      flags: [],
      lastUpdated: Date.now(),
      usesDrawGroups: useTiers,
      difficulties: [],
      styles: [],
    },
    defaults: {
      flags: [],
      lowerLvlBound: 1,
      difficulties: [],
      style: "",
      upperLvlBound: -1,
    },
    i18n: {
      en: {
        name: pack.name,
        single: "Single",
        double: "Double",
        beginner: "Beginner",
        basic: "Basic",
        difficult: "Difficult",
        expert: "Expert",
        challenge: "Challenge",
        edit: "Edit",
        $abbr: {
          beginner: "Beg",
          basic: "Bas",
          difficult: "Dif",
          expert: "Exp",
          challenge: "Cha",
          edit: "Edit",
        },
      },
    },
    songs: [],
  };

  for (const parsedSong of pack.simfiles) {
    const { bg, banner, jacket } = parsedSong.title;
    const finalJacket = jacket || bg || banner;

    let bpm = parsedSong.displayBpm;
    if (bpm === "NaN") {
      if (parsedSong.minBpm === parsedSong.maxBpm) {
        bpm = parsedSong.minBpm.toString();
      } else {
        bpm = `${parsedSong.minBpm}-${parsedSong.maxBpm}`;
      }
    } else {
      const [low, high] = bpm.split("-").map((n) => Number.parseInt(n));
      if (Number.isInteger(low) && Number.isInteger(high)) {
        bpm = `${low}-${high}`;
      }
    }

    const song: Song = {
      name: parsedSong.title.titleName,
      name_translation: parsedSong.title.translitTitleName || "",
      jacket: finalJacket ? URL.createObjectURL(finalJacket) : "",
      bpm,
      artist: parsedSong.artist,
      charts: [],
    };
    for (const chart of parsedSong.availableTypes) {
      const chartData: Chart = {
        lvl: chart.feet,
        style: chart.mode,
        diffClass: chart.difficulty,
      };
      if (useTiers) {
        const tierMatch = parsedSong.title.titleName.match(/^\[T(\d+)\]/i);
        if (tierMatch && tierMatch.length > 0) {
          const parsedTier = parseInt(tierMatch[1]);
          chartData.drawGroup = parsedTier;
          lvlMax = Math.max(lvlMax, parsedTier);
        } else {
          throw new Error(
            'Expected song titles to include tiers in the form "[T01] ..." but found:\n' +
              parsedSong.title.titleName,
          );
        }
      } else {
        // lvl max is calculated on level for non-tiered packs
        lvlMax = Math.max(lvlMax, chartData.lvl);
      }
      song.charts.push(chartData);

      difficulties.add(chart.difficulty);
      styles.add(chart.mode);
    }
    data.songs.push(song);
  }

  data.meta.styles = Array.from(styles);
  data.defaults.difficulties = Array.from(difficulties);
  data.meta.difficulties = data.defaults.difficulties.map((key) => ({
    key,
    color: someColors[key] || "grey", // TODO?
  }));
  data.defaults.upperLvlBound = lvlMax;
  data.defaults.style = data.meta.styles[0];

  return data;
}
