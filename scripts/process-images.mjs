/**
 * Place manually downloaded images into `new-jackets`
 * and run this to downscale and post-proccess names
 **/
import jimp from "jimp";
import { statSync, readdirSync } from "fs";
import { resolve, join, dirname } from "path";

import { fileURLToPath } from "url";
const __dirname = dirname(fileURLToPath(import.meta.url));
const IN_DIR = resolve(__dirname, "../new-jackets");
const OUT_DIR = resolve(__dirname, "../processed-jackets");

function transformFilename(f) {
  return f;
}

async function processImg(input, output) {
  try {
    const img = await jimp.read(input);

    await img.resize(200, jimp.AUTO).quality(80).writeAsync(output);

    console.log(
      `Wrote ${output} (${(statSync(output).size / 1024).toFixed(0)}kb)`,
    );
  } catch (e) {
    console.error(`Failed to process ${input}`);
  }
}

for (const filename of readdirSync(IN_DIR)) {
  const input = join(IN_DIR, filename);
  const output = join(OUT_DIR, transformFilename(filename));
  processImg(input, output);
}
