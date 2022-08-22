const fs = require("fs");

if (!fs.existsSync("pump.db")) {
  console.error(
    "No local data found, download a copy from the url below and save it as pump.db",
    "  https://github.com/AnyhowStep/pump-out-sqlite3-dump/tree/master/dump"
  );
  process.exit(0);
}

const db = require("better-sqlite3")("pump.db");

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
);
`
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
	);
`
  )
  .all();

const songsById = new Map();
for (const song of songs) {
  songsById.set(song.saIndex, song);
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
    diffClass: chart.modeId,
    style: "",
  });
  const flags = [
    chart.routine && "routine",
    chart.coOp && "coop",
    chart.performance && "performance",
  ].filter(Boolean);
  if (flags.length) {
    song.charts[song.charts.length - 1].flags = flags;
  }
}

console.log(songs);
db.close();
