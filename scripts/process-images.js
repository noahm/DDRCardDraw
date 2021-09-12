/** Place manually downloaded images from ZiV simfiles into `new-jackets` and run this to downscale and post-proccess names */
const jimp = require("jimp");
const fs = require("fs");
const path = require("path");

const IN_DIR = path.resolve(__dirname, "../new-jackets");
const OUT_DIR = path.resolve(__dirname, "../processed-jackets");

function transformFilename(f) {
  return `${f.slice(0, -11)}.jpg`;
}

async function processImg(input, output) {
  try {
    const img = await jimp.read(input);

    await img.resize(200, 200).quality(80).writeAsync(output);

    console.log(
      `Wrote ${output} (${(fs.statSync(output).size / 1024).toFixed(0)}kb)`
    );
  } catch (e) {
    console.error(`Failed to process ${input}`);
  }
}

for (const filename of fs.readdirSync(IN_DIR)) {
  const input = path.join(IN_DIR, filename);
  const output = path.join(OUT_DIR, transformFilename(filename));
  processImg(input, output);
}
