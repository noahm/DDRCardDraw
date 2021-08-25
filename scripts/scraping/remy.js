const path = require("path");
const { JSDOM } = require("jsdom");
const { downloadJacket } = require("../utils");

module.exports = {
  getJacketFromRemySong,
};

/** Will try to return a jacket URL from the wiki page, if found */
async function getJacketFromRemySong(pageUrl, overrideSongName) {
  const dom = await JSDOM.fromURL(pageUrl);
  const songName =
    overrideSongName || decodeURIComponent(path.basename(pageUrl));
  // find images
  const images = Array.from(
    dom.window.document.querySelectorAll(".thumb.tright")
  );
  if (!images.length) {
    return;
  }
  if (images.length === 1) {
    return getJacketFromThumb(images[0], songName);
  }
  // if multiple
  for (const finder of [
    // look for presence of DDR or DanceDanceRevolution
    (node) => node.textContent.includes("DanceDanceRevolution"),
    (node) => node.textContent.includes("DDR"),
    // then look for "jacket"
    (node) => node.textContent.includes("jacket"),
    // look for a square aspect ratio
    (node) => {
      const img = node.querySelector("img");
      return img.height === img.width;
    },
    // finally, fall back to first appearance
    () => true,
  ]) {
    let candidate = images.find(finder);
    if (candidate) {
      return getJacketFromThumb(candidate, songName);
    }
  }
}

function getJacketFromThumb(node, songName) {
  const url = node.querySelector("img").src;
  return downloadJacket(url, songName);
}
