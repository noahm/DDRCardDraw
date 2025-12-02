import type { JSDOM } from "jsdom";

import { getDom } from "../utils.mts";
import type { Song } from "../../src/models/SongData.ts";

/** Will try to return a jacket URL from the wiki page, if found
 * @param pageUrl Page URL
 */
async function getMetaFromRemy(pageUrl: string) {
  const dom = await getDom(pageUrl);
  if (!dom) return null;
  const firstP = dom.window.document.querySelector("#mw-content-text p");
  const artist = firstP?.innerHTML.match(/Artist: (.+)<br>/);
  const bpm = firstP?.innerHTML.match(/BPM: (.+)<br>/);
  return {
    artist: artist?.[1],
    bpm: bpm?.[1],
  };
}

/**
 * Try to guess RemyWiki URL from song name
 * @param songName Song name
 * @param series Series name used for RemyWiki categories (ex. "DanceDanceRevolution", "Jubeat")
 */
async function guessUrlFromName(songName: string, series: string) {
  try {
    const urlGuess = new URL(
      songName.replaceAll(" ", "_").replaceAll(":", "%3A"),
      "https://remywiki.com/",
    );
    const dom = await getDom(urlGuess.toString());
    if (dom && isSongPage(dom, series)) return getPageUrl(dom);
  } catch {}
  return undefined;

  function isSongPage(dom: JSDOM, series: string) {
    return !!dom.window.document.querySelector(
      `a[href="/Category:${series}_Songs"]`,
    );
  }

  function getPageUrl(dom: JSDOM) {
    const link = dom.window.document.querySelector<HTMLLinkElement>(
      "link[rel=canonical]",
    );
    const ogUrl = dom.window.document.querySelector<HTMLMetaElement>(
      'meta[property="og:url"]',
    );
    return link?.href ?? ogUrl?.content;
  }
}

/** Already fetched from RemyWiki */
const alreadyFetched = new Set();
/**
 * Try to get song meta data from RemyWiki if missing
 * @param song Song to get meta for
 * @param series Series to look for
 * @returns whether any meta was added
 */
export async function tryGetMetaFromRemy(
  song: Pick<Song, "name"> & Partial<Pick<Song, "remyLink" | "bpm" | "artist">>,
  series: string,
): Promise<boolean> {
  if (song.remyLink || alreadyFetched.has(song.name)) return false;

  // Try to guess remyLink from name only once
  alreadyFetched.add(song.name);
  song.remyLink ||= await guessUrlFromName(song.name, series);
  if (!song.remyLink) return false;

  console.log(`Added "${song.name}" remyLink: ${song.remyLink}`);

  if (!song.bpm || !song.artist) {
    const meta = await getMetaFromRemy(song.remyLink);
    if (!song.bpm && meta?.bpm) {
      song.bpm = meta.bpm;
      console.log(`Added "${song.name}" bpm from remyLink: ${meta.bpm}`);
    }
    if (!song.artist && meta?.artist) {
      song.artist = meta.artist;
      console.log(`Added "${song.name}" artist from remyLink: ${meta.artist}`);
    }
  }
  return true;
}
