const fs = require("fs");
const path = require("path");
const prettier = require("prettier");
const { default: pqueue } = require("p-queue");
const jimp = require("jimp");
const inquirer = require("inquirer");
const sanitize = require("sanitize-filename");

const { JSDOM } = require("jsdom");

/**
 * @param {string} url
 */
async function getDomInternal(url) {
  try {
    return JSDOM.fromURL(url);
  } catch (e) {
    console.error(e);
  }
}

function getDom(url) {
  return requestQueue.add(() => getDomInternal(url));
}

function writeJsonData(data, filePath) {
  data.meta.lastUpdated = Date.now();
  return fs.promises.writeFile(
    filePath,
    prettier.format(JSON.stringify(data), { filepath: filePath })
  );
}

const requestQueue = new pqueue({
  concurrency: 6, // 6 concurrent max
  interval: 1000,
  intervalCap: 10, // 10 per second max
});
const JACKETS_PATH = path.resolve(__dirname, "../src/assets/jackets");

let JACKET_PREFIX = "";
function setJacketPrefix(prefix) {
  JACKET_PREFIX = prefix;
}

/**
 * @param coverUrl {string} url of image to fetch
 * @param localFilename {string | undefined} override filename found in url
 *
 * queues a cover path for download into the imageQueue.
 * Always skips if file already exists.
 * Immediately returns the relative path to the jacket where it will be saved
 */
function downloadJacket(coverUrl, localFilename = undefined) {
  if (!localFilename) {
    localFilename = JACKET_PREFIX + path.basename(coverUrl);
  } else {
    localFilename = JACKET_PREFIX + localFilename;
  }
  if (!localFilename.endsWith(".jpg")) {
    localFilename += ".jpg";
  }
  const sanitizedFilename = sanitize(path.basename(localFilename));
  const outputPath = path.join(path.dirname(localFilename), sanitizedFilename);
  const absoluteOutput = path.join(JACKETS_PATH, outputPath);
  if (!fs.existsSync(absoluteOutput)) {
    requestQueue
      .add(() => jimp.read(coverUrl))
      .then((img) =>
        img.resize(128, jimp.AUTO).quality(80).writeAsync(absoluteOutput)
      )
      .catch((e) => {
        console.error("image download failure");
        console.error(e);
      });
  }

  return outputPath;
}

let jobCount = 0;

function reportQueueStatusLive() {
  const ui = new inquirer.ui.BottomBar();

  requestQueue
    .on("add", () => {
      ui.updateBottomBar(queueStatus());
    })
    .on("active", () => {
      ui.updateBottomBar(queueStatus());
    })
    .on("next", () => {
      jobCount++;
      ui.updateBottomBar(queueStatus());
    })
    .on("idle", () => {
      ui.clean();
    });

  return ui;
}

function queueStatus() {
  return `Requests in flight: ${requestQueue.pending} Requests Waiting: ${requestQueue.size} Jobs done: ${jobCount}`;
}

module.exports = {
  writeJsonData,
  downloadJacket,
  requestQueue,
  reportQueueStatusLive,
  getDom,
  setJacketPrefix,
};
