# DDR Tools

[![Discord](https://img.shields.io/discord/1013159796024823898?label=discord&style=flat-square)](https://discord.gg/QPyEATsbP7) ![GitHub contributors](https://img.shields.io/github/contributors/noahm/ddrcarddraw?style=flat-square) ![GitHub branch checks state](https://img.shields.io/github/checks-status/noahm/ddrcarddraw/main?style=flat-square) ![GitHub last commit](https://img.shields.io/github/last-commit/noahm/ddrcarddraw?style=flat-square) ![Libraries.io dependency status for GitHub repo](https://img.shields.io/librariesio/github/noahm/DDRCardDraw?style=flat-square)

The official build is available at [https://ddr.tools/](https://ddr.tools/). [Read all about what the app can do in the user manual.](https://github.com/noahm/DDRCardDraw/blob/main/docs/readme.md)

## Customizing / Contributing

This app can be easily customized for any format a tournament might use, including adding song data for other games. If you have requests or ideas, you're welcome reach out on our [Discord server](https://discord.gg/QPyEATsbP7), [Facebook messenger](https://m.me/noah.manneschmidt), or [on the fediverse](https://mastodon.content.town/@noahm).

If you want to take a stab at developing features yourself, you will need have node.js >= 18.0.0 installed along with [yarn](https://yarnpkg.com/) and some familarity with React probably helps.

Clone this repo to your computer. Then the following commands will be useful:

```sh
# Before running anything else, do this!
# It's a one-time local install of dependencies needed to build the app.
yarn install

# local development will start, with app running at http://localhost:8080/
# edits to the files in ./src/ will automatically reload the browser
yarn start

# if you make changes to any game/song data in ./src/songs/ this will give
# a basic sanity check on the format and contents of it
yarn validate:json

# build a zipped, standalone copy of the app that runs entirely offline,
# jacket images and all! simply unzip somewhere and open index.html
yarn build:zip
```

## Data imports

There are some other useful scripts in `scripts/` that help in maintaining data integrity and pulling in new song data. Several have top-level aliases so you can conveniently update song data: (must have node and yarn installed, and run `yarn install` once, as above)

```sh
# download latest StepManiaX song data and jackets
yarn import:smx

# download latest DDR A3 song data and jackets (blends data from ZIv, RemyWiki, skillattack)
yarn import:ddr

# import an ITG/StepMania song pack into card draw
yarn import:itg path/to/pack/folder some-stub-name

# import the latest Pump it Up data using a data dump found here:
# https://github.com/AnyhowStep/pump-out-sqlite3-dump/
yarn import:pump path/to/pumpout/db
```

Ideas for future develoment are now being tracked as issues on this repo. Feel free to jump in if you want to help build out something new!
