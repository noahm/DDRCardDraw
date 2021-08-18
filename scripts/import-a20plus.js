const fs = require("fs");
const path = require("path");
const prettier = require("prettier");
const { getSongsFromZiv } = require("../scraper/a20plus");

/** @param songs {Array<{}>} */
function sortSongs(songs) {
  for (const song of songs) {
    song.charts.sort((chartA, chartB) => {
      if (chartA.style !== chartB.style) {
        // sort singles first, doubles second
        return chartA.style > chartB.style ? -1 : 1;
      }
      // sort by level within style
      return chartA.lvl - chartB.lvl;
    });
  }
  return songs.sort((songA, songB) =>
    songA.name.toLowerCase() > songB.name.toLowerCase() ? 1 : -1
  );
}

/** returns data to use for given songs */
function mergeSongs(oldData, newData) {
  if (!oldData) {
    console.log(`  Adding new song ${newData.name}`);
    return newData;
  }
  const data = { ...newData, jacket: oldData.jacket, flags: oldData.flags };
  if (oldData.artist_translation.length > data.artist_translation.length) {
    data.artist_translation = oldData.artist_translation;
  }
  return data;
}

async function importSongsFromZiv(indexedSongs) {
  const latestSongs = await getSongsFromZiv();
  console.log(`Found ${latestSongs.length} songs on ZiV`);
  for (const song of latestSongs) {
    indexedSongs[song.name] = mergeSongs(indexedSongs[song.name], song);
  }
}

async function main() {
  const targetFile = path.join(__dirname, "../src/songs/a20plus.json");
  const existingData = JSON.parse(
    fs.readFileSync(targetFile, { encoding: "utf8" })
  );
  const prevCount = existingData.songs.length;
  /** index of songs by title */
  const indexedSongs = {};
  for (const song of existingData.songs) {
    if (indexedSongs[song.name]) {
      console.warn(`Duplicate song title: ${song.name}`);
    }
    indexedSongs[song.name] = song;
  }

  await importSongsFromZiv(indexedSongs);

  existingData.songs = sortSongs(Object.values(indexedSongs));
  fs.writeFileSync(
    targetFile,
    prettier.format(JSON.stringify(existingData), { filepath: targetFile })
  );

  console.log(
    `Wrote ${existingData.songs.length} (${existingData.songs.length -
      prevCount} new) sorted songs to a20plus.json`
  );
}
main();
