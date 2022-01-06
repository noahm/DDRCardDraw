const xspawn = require("cross-spawn");
const { readdirSync } = require("fs");
const { resolve, join, relative } = require("path");
const { writeJsonData } = require("./utils");

const DATA_FILE_DIR = resolve(join(__dirname, "../src/songs"));
const dataFileNames = readdirSync(DATA_FILE_DIR);

function lastModified(filePath) {
  const relativeToRoot = relative(join(__dirname, ".."), filePath);
  const output = xspawn.sync(
    "git",
    ["log", "-1", "--pretty=%ci", relativeToRoot],
    { encoding: "utf-8" }
  );
  console.log({
    filePath: relativeToRoot,
    output: output.stdout,
  });
  return new Date(output.stdout.trim());
}

for (const dataFile of dataFileNames) {
  const filePath = join(DATA_FILE_DIR, dataFile);
  const songData = require(filePath);
  songData.meta.lastUpdated = lastModified(filePath).getTime();
  writeJsonData(songData, filePath);
}
