This folder contains utility scripts, mostly for helping to maintain data integrity.

`scraping/*` contains utility functions and historical efforts to scrape data from
various online sources to collect DDR song data and jacket images.

The `import-*.js` scripts help bring in data from various sources, sometimes online,
sometimes local DB files or data dumps.

`validate.js` is important as it does a bunch of sanity checks on all data files,
ensures they match the specified schema for song data (from `songs.schema.json`),
and finally does some code-gen to write an updated typescript interface for that
song data into `src/models/SongData.ts`
