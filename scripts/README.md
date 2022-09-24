# Scripts

This folder contains utility scripts, mostly for helping to maintain data integrity.

`scraping/*` contains utility functions and historical efforts to scrape data from
various online sources to collect DDR song data and jacket images.

The `import-*.js` scripts help bring in data from various sources, sometimes online,
sometimes local DB files or data dumps.

`validate.js` is important as it does a bunch of sanity checks on all data files,
ensures they match the specified schema for song data (from `songs.schema.json`),
and finally does some code-gen to write an updated typescript interface for that
song data into `src/models/SongData.ts`

## Sound Voltex (import-sdvx.js)

### 1. Getting chart jackets

The _Sound Voltex_ import flow expects the jackets directory to find each chart's jacket. The jackets can be mass copied from the arcade data. The arcade data stores 3 sizes for each jacket. Only the small jackets are required which are suffixed with `_s`.

Start by opening a Unix shell at the arcade data `./data` directory, then run the following.

```sh
mkdir jackets
find ./music -type f -name "*_s.png" | xargs cp -t jackets
```

The resulting jackets are saved in the `jackets` directory which can then be copied to the project.

### 2. Importing from music_db.xml

_Sound Voltex_ import data can be generated from arcade data with the `music_db.xml` file the `./data/others/` directory. The import can be run with the top-level yarn alias `import:sdvx` and by providing a path to the `music_db.xml` as an argument.

```sh
yarn import:sdvx "C:\Games\SDVX6\data\others\music_db.xml"
```
