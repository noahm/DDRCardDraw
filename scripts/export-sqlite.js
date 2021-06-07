const sqlite3 = require("sqlite3");
const { open } = require("sqlite");

function parseBpm(bpmAsString) {
  const [min, max] = bpmAsString.split("-").map((v) => parseInt(v, 10));
  if (!max) {
    return { min, max: min };
  }
  return { min, max };
}

(async () => {
  const db = await open({
    filename: "./dance_data.db",
    driver: sqlite3.Database,
  });

  const gameData = require("../src/songs/a20plus.json");

  const { lastID: gameID } = await db.run(
    "INSERT INTO games (name) VALUES (?)",
    gameData.i18n.en.name
  );

  /** @type {Record<string, number>} */
  const categoryIndex = {};
  async function getOrAddCategory(name) {
    if (categoryIndex[name]) {
      return categoryIndex[name];
    }
    const { lastID } = await db.run(
      "INSERT INTO categories (game_id, name) VALUES (?, ?)",
      gameID,
      name
    );
    categoryIndex[name] = lastID;
    return lastID;
  }

  /** @type {Record<string, number>} */
  const flagIndex = {};
  async function getOrAddFlag(name) {
    if (flagIndex[name]) {
      return flagIndex[name];
    }
    const { lastID } = await db.run(
      "INSERT INTO flags (name) VALUES (?)",
      name
    );
    flagIndex[name] = lastID;
    return lastID;
  }

  let songCount = 0;
  for (const song of gameData.songs) {
    console.log(`Adding song ${++songCount}: ${song.name}`);
    const { min, max } = parseBpm(song.bpm);
    const { lastID: songID } = await db.run(
      "INSERT INTO songs (game_id, native_title, native_artist, jacket_image, bpm_min, bpm_max, translit_title, translit_artist) VALUES (?,?,?,?,?,?,?,?)",
      gameID,
      song.name,
      song.artist,
      song.jacket ? "https://ddrdraw.surge.sh/jackets/" + song.jacket : null,
      min,
      max,
      song.name_translation ?? null,
      song.artist_translation ?? null
    );

    if (song.flags) {
      for (const flag of song.flags) {
        await db.run(
          "INSERT INTO song_flags (song_id, flag_id) VALUES (?,?)",
          songID,
          await getOrAddFlag(flag)
        );
      }
    }

    for (const chart of song.charts) {
      const { lastID: chartID } = await db.run(
        "INSERT INTO charts (song_id, game_id, lvl) VALUES (?,?,?)",
        songID,
        gameID,
        chart.lvl
      );

      await db.run(
        "INSERT INTO chart_categories (chart_id, category_id) VALUES (?,?)",
        chartID,
        await getOrAddCategory(chart.diffClass)
      );
      await db.run(
        "INSERT INTO chart_categories (chart_id, category_id) VALUES (?,?)",
        chartID,
        await getOrAddCategory(chart.style)
      );

      if (chart.flags) {
        for (const flag of chart.flags) {
          await db.run(
            "INSERT INTO chart_flags (chart_id, flag_id) VALUES (?,?)",
            chartID,
            await getOrAddFlag(flag)
          );
        }
      }
    }
  }

  await db.close();
})();
