/**
 * Utility script to migrate shock arrow data to a per-chart flag
 */

const { writeJsonData } = require("./utils");
const { resolve } = require("path");

let songData = require(`../src/songs/a20plus.json`);

for (const song of songData.songs) {
  for (const chart of song.charts) {
    if (chart.shock) {
      chart.flags ? chart.flags.push("shock") : (chart.flags = ["shock"]);
    }
  }
}

writeJsonData(songData, resolve(__dirname, "../src/songs/a20plus.json"));
