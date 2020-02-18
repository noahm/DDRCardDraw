# DDR Card Draw

This is web-app that allows random draw of songs from Dance Dance Revolution (A20, Ace, and Extreme)
with a variety of optional conditions, primarially around difficulty level. The intended use case is
for competitive tournaments, but it may also be useful as a training tool.

The app is officially available at [https://ddrdraw.surge.sh/](https://ddrdraw.surge.sh/)
or as a downloadable zip file from the [releases page](https://github.com/noahm/DDRCardDraw/releases).
The app is designed such that even the online version will work without any internet connection after
being loaded once in any modern web browser.

Original app by Jeff Lloyd; ongoing maintenance provided by [noahm](https://github.com/noahm)
and [FuriousDCSL](https://github.com/FuriousDCSL). Contributions are welcome!

## Customizing / Contributing

This app can be easily customized for any format a tournament might use, including adding song
data for other games. If you have requests or ideas, [please reach out](https://m.me/noah.manneschmidt)!

If you want to take a stab at it yourself, you will want to have node.js >= 10.0.0 installed along with
[yarn](https://yarnpkg.com/) and some familarity with [Preact](https://github.com/developit/preact)
(or react) apps.

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

# build a zipped, standalone copy of the app that runs entirely offline
yarn build
```

Ideas for future develoment are now being tracked as issues on this repo. Feel free to jump in if you
want to help build out something new!
