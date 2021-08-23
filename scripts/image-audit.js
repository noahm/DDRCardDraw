const fs = require("fs");
const path = require("path");
const inquirer = require("inquirer");
const fuzzysearch = require("fuzzy-search");
const { writeJsonData } = require("./utils");

const jacketDir = path.resolve(__dirname, "..", "src/assets/jackets");
const targetFile = path.resolve(__dirname, "../src/songs/a20plus.json");

const images = fs
  .readdirSync(jacketDir)
  .filter((file) => !file.startsWith("ex_"));
const jacketIndex = new fuzzysearch(images, undefined, { sort: true });

function jacketExists(song) {
  return fs.existsSync(path.join(jacketDir, song.jacket));
}

function jacketOnDisc(song) {
  return (
    fs.existsSync(path.join(jacketDir, song.name + ".png")) ||
    fs.existsSync(path.join(jacketDir, song.name_translation + ".png"))
  );
}

async function promptForJacket(song) {
  const jacketKey = song.name_translation || song.name;
  let results = jacketIndex.search(jacketKey);
  if (!results.length) {
    results = jacketIndex.search(jacketKey.slice(0, 3));
  }
  results.unshift("");
  const answers = await inquirer.prompt({
    type: "list",
    name: "image",
    message: `Pick a jacket for ${jacketKey}`,
    choices: results,
  });
  return answers.image;
}

const counts = {
  missingJacket: [],
  unusedJacketOnDisc: [],
  missingOnDisc: [],
};

async function main() {
  const data = require(targetFile);

  for (const song of data.songs) {
    if (song.jacket) {
      if (!jacketExists(song)) {
        counts.missingOnDisc.push(song.name);
      }
    } else {
      counts.missingJacket.push(song.name);
      if (jacketOnDisc(song)) {
        counts.unusedJacketOnDisc.push(song.name);
      } else {
        // song.jacket = await promptForJacket(song);
      }
    }
  }

  console.log(counts);
  console.log({
    missingJacket: counts.missingJacket.length,
    unusedJacketOnDisc: counts.unusedJacketOnDisc.length,
    missingOnDisc: counts.missingOnDisc.length,
  });
  writeJsonData(data, targetFile);
}

main();
