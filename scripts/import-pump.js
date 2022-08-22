const fs = require("fs");
const path = require("path");
const {
  downloadJacket,
  requestQueue,
  reportQueueStatusLive,
  writeJsonData,
} = require("./utils");

if (!fs.existsSync("pump.db")) {
  console.error(
    "No local data found, download a copy from the url below and save it as pump.db",
    "  https://github.com/AnyhowStep/pump-out-sqlite3-dump/tree/master/dump"
  );
  process.exit(0);
}

const GET_IMAGES = true;

function queueJacketDownload(jacketPath) {
  const filename = path.basename(jacketPath, ".png");
  const outPath = `pump/${filename}.jpg`;
  if (GET_IMAGES) {
    downloadJacket(`https://pumpout2020.anyhowstep.com${jacketPath}`, outPath);
  }

  return outPath;
}

async function main() {
  const db = require("better-sqlite3")("pump.db");
  let lvlMax = 0;
  const ui = reportQueueStatusLive();

  const songs = db
    .prepare(
      `SELECT
song.songId saIndex,
song.internalTitle name
FROM
song
WHERE
EXISTS(
  SELECT
    *
  FROM
    songVersion
  INNER JOIN
    version USING (versionId)
  WHERE
    songVersion.songId = song.songId AND
    songVersion.operationId <> 2 AND
    version.sortOrder = (
    SELECT
      MAX(version.sortOrder)
    FROM
      songVersion
    INNER JOIN
      version USING (versionId)
    WHERE
      songVersion.songId = song.songId AND
      EXISTS(
        SELECT
          *
        FROM
          _derived_versionAncestor
        WHERE
          songVersion.versionId = _derived_versionAncestor.ancestorId AND
          _derived_versionAncestor.versionId = 176
      )
    )
);`
    )
    .all();

  const charts = db
    .prepare(
      `
WITH
	difficultyRatings as (
		select crv.chartId, chartRating.difficultyId, mode.modeId, routine, coOp, performance, max(version.sortOrder)
		from
			chartRatingVersion crv,
			chartRating using (chartRatingId),
			mode using (modeId),
			version using (versionId)
		group by crv.chartId
	)
SELECT
	chartId,
	chart.songId,
	difficultyRatings.difficultyId diffLvl,
	difficultyRatings.modeId,
  routine, coOp, performance
FROM
	chart,
	song using (songId),
	difficultyRatings using (chartId)
WHERE
	EXISTS(
	  	SELECT
	  		*
	  	FROM
	  		chartVersion
	  	INNER JOIN
	  		version USING (versionId)
	  	WHERE
	  		chartVersion.chartId = chart.chartId AND
	  		chartVersion.operationId <> 2 AND
	  		version.sortOrder = (
			  SELECT
				  MAX(version.sortOrder)
			  FROM
				  chartVersion
			  INNER JOIN
				  version USING (versionId)
			  WHERE
				  chartVersion.chartId = chart.chartId AND
				  EXISTS(
					  SELECT
						  *
					  FROM
						  _derived_versionAncestor
					  WHERE
						  chartVersion.versionId = _derived_versionAncestor.ancestorId AND
						  _derived_versionAncestor.versionId = 176
				  )
		  	)
	);`
    )
    .all();

  const jackets = db
    .prepare(
      `
SELECT
	songCard.songId,
	songCard.path
FROM
	songCard
WHERE
	EXISTS(
	  	SELECT
	  		*
	  	FROM
	  		songCardVersion
	  	INNER JOIN
	  		version USING (versionId)
	  	WHERE
	  		songCardVersion.songCardId = songCard.songCardId AND
	  		songCardVersion.operationId <> 2 AND
	  		version.sortOrder = (
			  SELECT
				  MAX(version.sortOrder)
			  FROM
				  songCardVersion
			  INNER JOIN
				  version USING (versionId)
			  WHERE
				  songCardVersion.songCardId = songCard.songCardId
		  	)
	);`
    )
    .all();

  const difficulties = db
    .prepare(
      `select
      internalAbbreviation key,
      internalHexColor color,
      internalTitle title,
      modeId
    from mode order by sortOrder`
    )
    .all();
  const difficultyById = new Map();
  const diffTranslit = {};
  for (const d of difficulties) {
    difficultyById.set(d.modeId, { ...d });
    diffTranslit[d.key] = d.title;
    delete d.modeId;
    delete d.title;
  }

  const artistQuery = db.prepare(`
select
	artist.internalTitle,
	prefix
from
	songArtist,
	artist using (artistId)
WHERE
	songId = ?
order by
	sortOrder`);
  function getArtistForSong(songId) {
    return artistQuery.all(songId).reduce((acc, curr) => {
      if (!acc) {
        return curr.internalTitle;
      }
      return `${acc} ${curr.prefix || "&"} ${curr.internalTitle}`;
    }, "");
  }

  const bpmQuery = db.prepare(`
select
	bpmMin min, bpmMax max
from
	songBpmVersion sbv,
	songBpm using (songBpmId),
	version using (versionId)
where sbv.songId = ?
order by version.sortOrder desc`);
  function getBpmForSong(songId) {
    const bpm = bpmQuery.get(songId);
    if (!bpm.min && !bpm.max) {
      return "???";
    }
    if (bpm.min === bpm.max) {
      return bpm.min.toString();
    }
    return `${bpm.min}-${bpm.max}`;
  }

  const jacketPathsById = new Map();
  for (const jacket of jackets) {
    jacketPathsById.set(jacket.songId, jacket.path);
  }

  const songsById = new Map();
  for (const song of songs) {
    songsById.set(song.saIndex, song);
    const jacketPath = jacketPathsById.get(song.saIndex);
    if (!jacketPath) {
      console.error("missing jacket for song", song);
    } else {
      song.jacket = queueJacketDownload(jacketPath);
    }
    song.artist = getArtistForSong(song.saIndex);
    song.bpm = getBpmForSong(song.saIndex);
    song.saIndex = song.saIndex.toString();
  }

  for (const chart of charts) {
    const song = songsById.get(chart.songId);
    if (!song) {
      continue;
    }
    if (!song.charts) {
      song.charts = [];
    }
    song.charts.push({
      lvl: chart.diffLvl,
      diffClass: difficultyById.get(chart.modeId).key,
      style: chart.coOp ? "coop" : "solo",
    });

    if (chart.diffLvl > lvlMax) {
      lvlMax = chart.diffLvl;
    }
  }

  const pumpData = {
    meta: {
      styles: ["solo", "coop"],
      difficulties,
      flags: [],
      lvlMax,
      lastUpdated: Date.now(),
    },
    defaults: {
      style: "solo",
      difficulties: ["S", "D"],
      flags: [],
      lowerLvlBound: 14,
      upperLvlBound: 20,
    },
    i18n: {
      en: {
        name: "Pump It Up XX",
        solo: "Solo",
        coop: "Co-Op",
        ...diffTranslit,
        $abbr: {
          S: "S",
          HDB: "HDB",
          D: "D",
          SP: "SP",
          DP: "DP",
          C: "C",
          R: "R",
        },
      },
    },
    songs,
  };

  db.close();

  await writeJsonData(
    pumpData,
    path.resolve(path.join(__dirname, "../src/songs/pump.json"))
  );
  if (requestQueue.size) {
    ui.log.write("waiting on images to finish downloading...");
    await requestQueue.onIdle();
  }
  ui.log.write("done!");
  ui.close();
}

main().catch((e) => {
  console.error(e);
});