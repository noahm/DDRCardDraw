const fs = require("fs");
const path = require("path");
const prettier = require("prettier");
const { default: pqueue } = require("p-queue");
const jimp = require("jimp");
const inquirer = require("inquirer");

function writeJsonData(data, filePath) {
  fs.writeFileSync(
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

/**
 * @param outputPath {string | undefined} [optional] save to disk, relative to existing jackets
 * queues a cover path for download into the imageQueue
 * Always skips if file already exists, assumes square aspect ratio
 * Immediately returns the relative path to the jacket where it is saved
 */
function downloadJacket(coverUrl, outputPath) {
  if (!outputPath) {
    outputPath = path.basename(coverUrl);
  }
  if (!outputPath.endsWith(".jpg")) {
    outputPath += ".jpg";
  }
  const absoluteOutput = path.join(JACKETS_PATH, outputPath);
  if (!fs.existsSync(absoluteOutput)) {
    requestQueue
      .add(() => jimp.read(coverUrl))
      .then((img) =>
        img.resize(128, 128).quality(80).writeAsync(absoluteOutput)
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
};
