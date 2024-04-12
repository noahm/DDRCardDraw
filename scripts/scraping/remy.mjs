// @ts-check
/** @typedef {import("jsdom").JSDOM} JSDOM */

import * as path from "path";
import { downloadJacket, getDom } from "../utils.mjs";

/** Will try to return a jacket URL from the wiki page, if found
 * @param {string} pageUrl
 * @param {string} overrideSongName
 */
export async function getJacketFromRemySong(pageUrl, overrideSongName) {
  const dom = await getDom(pageUrl);
  if (!dom) return;
  const songName =
    overrideSongName || decodeURIComponent(path.basename(pageUrl));
  // find images
  const images = Array.from(
    dom.window.document.querySelectorAll(".thumb.tright"),
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
      if (!img) return false;
      return img.height === img.width;
    },
    // finally, fall back to first appearance
    () => true,
  ]) {
    const candidate = images.find(finder);
    if (candidate) {
      return getJacketFromThumb(candidate, songName);
    }
  }
}

/**
 * @param {string} pageUrl url of game page on remy
 * @returns {Promise<Set<string>>}
 */
export async function getRemovedSongUrls(pageUrl) {
  try {
    const dom = await getDom(pageUrl);
    const songsTable =
      dom.window.document.getElementById("Removed_Songs").parentElement
        .nextElementSibling.nextElementSibling;
    const songLinks = new Set();
    for (const anchor of songsTable.querySelectorAll("tr td:first-child a")) {
      songLinks.add(anchor.href);
    }
    return songLinks;
  } catch {
    return new Set();
  }
}

/**
 *
 * @param {JSDOM} dom
 */
function isSongPage(dom) {
  return !!dom.window.document.querySelector('a[href="/Category:DDR_Songs"]');
}

/**
 *
 * @param {JSDOM} dom
 */
function canonicalUrlForPage(dom) {
  /** @type {HTMLLinkElement | null} */
  const link = dom.window.document.querySelector("link[rel=canonical]");
  if (link) return link.href;
  /** @type {HTMLMetaElement | null} */
  const ogUrl = dom.window.document.querySelector('meta[property="og:url"]');
  if (ogUrl) return ogUrl.content;
}

/**
 * @param {string} pageUrl
 */
export async function getCanonicalRemyURL(pageUrl) {
  const url = new URL(pageUrl);
  if (url.pathname === "/") return; // filter out non-links

  const dom = await getDom(pageUrl);
  if (!dom || !isSongPage(dom)) return;
  return canonicalUrlForPage(dom);
}

/**
 * @param {Element} node
 * @param {string} songName
 * @returns
 */
function getJacketFromThumb(node, songName) {
  /** @type {HTMLImageElement | null} */
  const img = node.querySelector("img");
  if (img && img.src) return downloadJacket(img.src, songName);
}

/**
 * @param {string} songName
 */
export async function guessUrlFromName(songName) {
  try {
    const urlGuess = new URL(
      songName.replaceAll(" ", "_"),
      "https://remywiki.com/",
    );
    const dom = await getDom(urlGuess.toString());
    if (dom && isSongPage(dom)) {
      return canonicalUrlForPage(dom);
    }
  } catch {}
}
