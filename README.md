# DDR Card Draw

This is web-app that allows random draw of songs from Dance Dance Revolution (A20, Ace, and Extreme)
with a variety of optional conditions, primarially around difficulty level. The primary use case is
for competitive tournaments, but it may also be useful as a training tool.

The app is officially available at [https://ddrdraw.surge.sh/](https://ddrdraw.surge.sh/)
or as a downloadable zip file from the [releases page](https://github.com/noahm/DDRCardDraw/releases).
The app is designed such that even the online version will work without any internet connection after
being loaded once in any modern web browser.

Original app by Jeff Lloyd; ongoing maintenance provided by [noahm](https://github.com/noahm)
and [FuriousDCSL](https://github.com/FuriousDCSL). Contributions are welcome!

## Customizing
This app can be easily customized for any special needs a tournament might have, including adding song
data for other games. If you have requests or ideas, [please reach out](https://m.me/noah.manneschmidt)!

If you want to take a stab at it yourself, you will want to have node.js >= 8.0.0 installed and some
familarity with [Preact](https://github.com/developit/preact) (or react) apps.

Clone this repo, and then the following commands will be useful:

```sh
# one time install of dependencies
npm install

# local development will start, with app running at http://localhost:8080/
# edits to the files in src will be reflected in real time
npm start

# double check any changes made to song lists in ./src/songs/
npm run validate

# build a zipped, standalone copy of the app
npm run build
```
