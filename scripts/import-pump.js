const fs = require("fs");
const path = require("path");
const {
  downloadJacket,
  requestQueue,
  reportQueueStatusLive,
  writeJsonData,
} = require("./utils");

const flaggableLabels = {
  "UNLOCK REQUIRED": {
    stub: "unlock",
    en: "Unlock required",
  },
  "AM.PASS EXCLUSIVE": {
    stub: "ampass",
    en: "AM Pass Exclusive",
  },
  UCS: {
    stub: "ucs",
    en: "UCS",
  },
  "LATIN AMERICA EXCLUSIVE": {
    stub: "latam_exc",
    en: "Latin America Exclusive",
  },
  "JAPAN EXCLUSIVE": {
    stub: "jpn_exc",
    en: "Japan Exclusive",
  },
  "PHILIPPINES EXCLUSIVE": {
    stub: "phl_exc",
    en: "Philippines Exclusive",
  },
};

const otherFlags = [];
const flagI18n = {};

for (const { stub, en } of Object.values(flaggableLabels)) {
  otherFlags.push(stub);
  flagI18n[stub] = en;
}

function labelToFlag(label) {
  if (flaggableLabels[label]) {
    return flaggableLabels[label].stub;
  }
  return false;
}

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

  const cuts = db
    .prepare("select * from cut where cutId <> 2 order by sortOrder")
    .all();
  const songs = db
    .prepare(
      `SELECT
song.songId saIndex,
song.internalTitle name,
song.cutId
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

  const rawDiffs = db
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
  const difficulties = [];
  for (const d of rawDiffs) {
    difficultyById.set(d.modeId, { ...d });
    diffTranslit[d.key] = d.title;
    delete d.modeId;
    delete d.title;

    if (d.key === "C") {
      // create copies for COOPx2 - COOPx5
      difficulties.push({ key: "C2", color: d.color });
      difficulties.push({ key: "C3", color: d.color });
      difficulties.push({ key: "C4", color: d.color });
      difficulties.push({ key: "C5", color: d.color });

      diffTranslit["C2"] = "Co-Op 2P";
      diffTranslit["C3"] = "Co-Op 3P";
      diffTranslit["C4"] = "Co-Op 4P";
      diffTranslit["C5"] = "Co-Op 5P";
      delete diffTranslit["C"];
    } else {
      difficulties.push({ key: d.key, color: d.color });
    }
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

  const flagsQuery = db.prepare(`
SELECT
	internalTitle
FROM
	label,
	chartLabel using (labelId)
WHERE
	chartId = ?
ORDER BY
	label.sortOrder DESC
`);
  function getFlagsForChart(chartId) {
    const rows = flagsQuery.all(chartId);
    const ret = [];
    for (const row of rows) {
      const flag = labelToFlag(row.internalTitle);
      if (flag) {
        ret.push(flag);
      }
    }
    if (ret.length) {
      return ret;
    }
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
    if (song.cutId !== 2) {
      song.flags = ["cut:" + song.cutId];
    }
    delete song.cutId;
  }

  for (const chart of charts) {
    const song = songsById.get(chart.songId);
    if (!song) {
      continue;
    }
    if (!song.charts) {
      song.charts = [];
    }
    const chartData = {
      lvl: chart.diffLvl,
      diffClass: difficultyById.get(chart.modeId).key,
      style: chart.coOp ? "coop" : "solo",
    };

    if (chartData.diffClass === "C") {
      // massage co-op chart nonsense
      chartData.diffClass = "C" + chartData.lvl;
      chartData.lvl = 1;
    }

    const flags = getFlagsForChart(chart.chartId);
    if (flags) {
      chartData.flags = flags;
    }
    song.charts.push(chartData);

    if (chart.diffLvl > lvlMax) {
      lvlMax = chart.diffLvl;
    }
  }

  const pumpData = {
    meta: {
      styles: ["solo", "coop"],
      difficulties,
      flags: [...otherFlags, ...cuts.map((cut) => "cut:" + cut.cutId)],
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
        ...flagI18n,
        ...cuts.reduce((acc, cut) => {
          acc["cut:" + cut.cutId] = cut.internalTitle;
          return acc;
        }, {}),
        $abbr: {
          S: "S",
          HDB: "HDB",
          D: "D",
          SP: "SP",
          DP: "DP",
          C2: "COOPx2",
          C3: "COOPx3",
          C4: "COOPx4",
          C5: "COOPx5",
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
