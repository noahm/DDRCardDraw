import type { GameData } from "../models/SongData";

/**
 * Base url of data.ddr.tools' CDN, injected at build time (webpack DefinePlugin)
 * alongside `DATA_API_BASE`: production cdn.data.ddr.tools, local wrangler dev
 * otherwise.
 */
export const CDN_BASE = process.env.CDN_BASE || "https://cdn.data.ddr.tools";

export function getJacketUrl(jacketFromData: string) {
  // Published bundles (ITG packs) carry absolute CDN urls into the
  // content-addressed jacket pool; bundled stock data uses relative paths.
  if (jacketFromData.startsWith("http")) {
    return jacketFromData;
  }
  const prefix = jacketFromData.startsWith("blob:") ? "" : "/jackets/";
  return `${prefix}${jacketFromData}`;
}

function legacyJacketUrl(jacket: string) {
  if (!jacket.startsWith("smx/")) {
    return jacket;
  }
  // file names carry characters like `&` that must be escaped in a url
  return `${CDN_BASE}/legacy/jackets/${jacket.split("/").map(encodeURIComponent).join("/")}`;
}

/**
 * SMX edit bundles published before stock data moved to the CDN carry relative
 * `smx/...` jacket paths into the app's bundled art. Those bundles are immutable,
 * so point their paths at the frozen copy of that art on the CDN instead, which
 * keeps them rendering once the app stops bundling jackets.
 */
export function withLegacyJacketUrls(data: GameData): GameData {
  for (const song of data.songs) {
    song.jacket = legacyJacketUrl(song.jacket);
    for (const chart of song.charts) {
      if (chart.jacket) {
        chart.jacket = legacyJacketUrl(chart.jacket);
      }
    }
  }
  return data;
}
