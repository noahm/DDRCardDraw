/**
 * Utility script to rewrite any song data from the old format
 * in the structure of the new more game-agnostic format. Will
 * overwrite all json files in the songs directory, but is safe
 * to run multiple times.
 */

const { readdirSync, writeFileSync } = require("fs");
const { resolve, join } = require("path");
const prettier = require("prettier");

const dataFileNames = readdirSync(resolve(join(__dirname, "../src/songs")));

/**
 * Map of old flag property to new flag name
 */
const flags = {
  unlock: "unlock",
  temp_unlock: "tempUnlock",
  extra_exclusive: "extraExclusive",
  removed: "removed",
  us_locked: "usLocked",
  gold_exclusive: "goldExclusive"
};
function setFlags(song) {
  if (song.flags) {
    return;
  }
  song.flags = [];
  for (const oldFlag in flags) {
    const newFlag = flags[oldFlag];
    if (song[oldFlag]) {
      song.flags.push(newFlag);
    }
    delete song[oldFlag];
  }
  if (!song.flags.length) {
    delete song.flags;
  }
}

function extractCharts(styleSet, styleName) {
  if (!styleSet) {
    return;
  }

  const charts = [];
  for (const diffClass in styleSet) {
    const chart = styleSet[diffClass];
    if (!chart) {
      continue;
    }

    setFlags(chart);
    if (chart.difficulty) {
      chart.lvl = parseInt(chart.difficulty, 10);
      delete chart.difficulty;
    }
    if (chart.step === "-") {
      delete chart.step;
    } else {
      chart.step = parseInt(chart.step, 10);
      if (!chart.step) {
        delete chart.step;
      }
    }
    if (chart.freeze === "-") {
      delete chart.freeze;
    } else {
      chart.freeze = parseInt(chart.freeze, 10);
      if (!chart.freeze) {
        delete chart.freeze;
      }
    }
    if (chart.shock === "-") {
      delete chart.shock;
    } else {
      chart.shock = parseInt(chart.shock, 10);
      if (!chart.shock) {
        delete chart.shock;
      }
    }
    chart.style = styleName;
    chart.diffClass = diffClass;
    charts.push(chart);
  }
  return charts;
}

for (const dataFile of dataFileNames) {
  let songData = require(`../src/songs/${dataFile}`);
  if (Array.isArray(songData)) {
    songData = {
      meta: {
        styles: ["define game styles here"],
        difficulties: [
          {
            key: "define difficulties here",
            color: "give each a distinctive css color"
          }
        ],
        flags: ["define filtering flags here"],
        lvlMax: 300
      },
      defaults: {
        style: "",
        difficulties: [],
        flags: [],
        lowerLvlBound: 5,
        upperLvlBound: 300
      },
      i18n: {
        en: {
          name: dataFile.split(".")[0],
          hey: "put translations here and below",
          note:
            "each style, difficulty, and flag must have a matching key here",
          $abbr: {
            "abbreviations!": "put abbreviations for your difficulties here"
          }
        },
        ja: {
          name: dataFile.split(".")[0],
          $abbr: {}
        }
      },
      songs: songData
    };
  }

  for (const song of songData.songs) {
    setFlags(song);
    const migratedCharts = [
      ...extractCharts(song.single, "single"),
      ...extractCharts(song.double, "double")
    ];
    delete song.single;
    delete song.double;
    if (!song.charts) {
      song.charts = [];
    }
    song.charts = song.charts.concat(migratedCharts);
  }

  writeFileSync(
    resolve(join(__dirname, "../src/songs/", dataFile)),
    prettier.format(JSON.stringify(songData), { filepath: dataFile })
  );
}
