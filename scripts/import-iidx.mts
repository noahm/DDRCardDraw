/**
 * Import or update IIDX data from textage.cc.
 */
import { readFile, writeFile } from "node:fs/promises";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import { JSDOM } from "jsdom";

import { exists, writeJsonData } from "./utils.mts";
import { TextageSongImporter } from "./scraping/textage.mts";
import type { GameData } from "../src/models/SongData.ts";

const jacketTemplateFilePath = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "jacket_template.svg",
);
type JacketPalette = {
  backdrop: string;
  accentUpper: string;
  accentLower: string;
};
const jacketPalettesByFolderName = new Map<string, JacketPalette>([
  [
    "1st style",
    { backdrop: "#000000", accentUpper: "#666666", accentLower: "#333333" },
  ],
  [
    "2nd style",
    { backdrop: "#000000", accentUpper: "#feb900", accentLower: "#d36a00" },
  ],
  [
    "3rd style",
    { backdrop: "#000000", accentUpper: "#e4007f", accentLower: "#e4007f" },
  ],
  [
    "4th style",
    { backdrop: "#000000", accentUpper: "#e60012", accentLower: "#666666" },
  ],
  [
    "5th style",
    { backdrop: "#000000", accentUpper: "#f5a100", accentLower: "#073190" },
  ],
  [
    "6th style",
    { backdrop: "#000000", accentUpper: "#9983be", accentLower: "#a5a5a5" },
  ],
  [
    "7th style",
    { backdrop: "#000000", accentUpper: "#488db2", accentLower: "#264a5c" },
  ],
  [
    "8th style",
    { backdrop: "#000000", accentUpper: "#ef7e00", accentLower: "#e7e8e8" },
  ],
  [
    "9th style",
    { backdrop: "#000000", accentUpper: "#ffffff", accentLower: "#01eef6" },
  ],
  [
    "10th style",
    { backdrop: "#000000", accentUpper: "#ff1a00", accentLower: "#091f58" },
  ],
  [
    "IIDX RED",
    { backdrop: "#000000", accentUpper: "#ff0000", accentLower: "#7b7978" },
  ],
  [
    "HAPPY SKY",
    { backdrop: "#000000", accentUpper: "#14ace9", accentLower: "#12398b" },
  ],
  [
    "DistorteD",
    { backdrop: "#000000", accentUpper: "#cabc20", accentLower: "#666666" },
  ],
  [
    "GOLD",
    { backdrop: "#000000", accentUpper: "#d7be52", accentLower: "#9f0080" },
  ],
  [
    "DJ TROOPERS",
    { backdrop: "#000000", accentUpper: "#a3fe09", accentLower: "#476618" },
  ],
  [
    "EMPRESS",
    { backdrop: "#000000", accentUpper: "#f40052", accentLower: "#a12f4c" },
  ],
  [
    "SIRIUS",
    { backdrop: "#000000", accentUpper: "#2c4d6f", accentLower: "#0f0c2a" },
  ],
  [
    "Resort Anthem",
    { backdrop: "#000000", accentUpper: "#eb4a32", accentLower: "#a23351" },
  ],
  [
    "Lincle",
    { backdrop: "#000000", accentUpper: "#40c0f0", accentLower: "#ef7c08" },
  ],
  [
    "tricoro",
    { backdrop: "#000000", accentUpper: "#f4f04b", accentLower: "#c32137" },
  ],
  [
    "SPADA",
    { backdrop: "#000000", accentUpper: "#f61108", accentLower: "#e3751b" },
  ],
  [
    "PENDUAL",
    { backdrop: "#000000", accentUpper: "#c93c61", accentLower: "#990d87" },
  ],
  [
    "copula",
    { backdrop: "#000000", accentUpper: "#fee05a", accentLower: "#88757e" },
  ],
  [
    "SINOBUZ",
    { backdrop: "#000000", accentUpper: "#44af6a", accentLower: "#6e2039" },
  ],
  [
    "CANNON BALLERS",
    { backdrop: "#000000", accentUpper: "#dc1003", accentLower: "#05b474" },
  ],
  [
    "Rootage",
    { backdrop: "#000000", accentUpper: "#feef13", accentLower: "#8f2608" },
  ],
  [
    "HEROIC VERSE",
    { backdrop: "#000000", accentUpper: "#331ba5", accentLower: "#c03ae3" },
  ],
  [
    "BISTROVER",
    { backdrop: "#000000", accentUpper: "#86d140", accentLower: "#6098c9" },
  ],
  [
    "CastHour",
    { backdrop: "#000000", accentUpper: "#fb6701", accentLower: "#1a2162" },
  ],
  [
    "RESIDENT",
    { backdrop: "#000000", accentUpper: "#010efd", accentLower: "#cb2690" },
  ],
  [
    "EPOLIS",
    { backdrop: "#000000", accentUpper: "#f0ff00", accentLower: "#6229d1" },
  ],
  [
    "Pinky Crush",
    { backdrop: "#000000", accentUpper: "#ec2f95", accentLower: "#00f7fe" },
  ],
  [
    "Sparkle Shower",
    { backdrop: "#000000", accentUpper: "#009f4c", accentLower: "#ffee00" },
  ],
  [
    "substream",
    { backdrop: "#000000", accentUpper: "#feb900", accentLower: "#d36a00" },
  ],
]);
const jacketFont = "bold 28px Evogria,sans-serif";
const jacketFontStyling = `fill:white;font:${jacketFont};dominant-baseline:middle;text-anchor:middle;stroke:#000000;stroke-width:2px`;

/**
 * Generate a version folder jacket SVG file based on the folder name and a template.
 * @param folderName Folder name to generate the jacket for.
 * @param jacketFilePath Path to the output SVG file.
 */
async function generateVersionFolderJacket(
  folderName: string,
  jacketFilePath: string,
) {
  const folderNameWidth = measureTextWidth(` ${folderName} `);

  let jacketSvgSource = await readFile(jacketTemplateFilePath, {
    encoding: "utf-8",
  });
  const jacketPalette = {
    folderName,
    folderNameStyling: jacketFontStyling,
    folderNameWidth: `${folderNameWidth}`,
    folderNameWidthHalf: `${folderNameWidth * 0.5}`,
    backdrop: "#000000",
    accentUpper: "#000000",
    accentLower: "#000000",
    ...(jacketPalettesByFolderName.get(folderName) ?? {}),
  };
  for (const [key, value] of Object.entries(jacketPalette)) {
    jacketSvgSource = jacketSvgSource.replaceAll(`{{${key}}}`, value);
  }

  await writeFile(jacketFilePath, jacketSvgSource, { encoding: "utf-8" });

  /**
   * Measure the width of a given text string using the specified font.
   * @param text The text string to measure.
   * @returns The width of the text string in pixels.
   */
  function measureTextWidth(text: string): number {
    var dom = new JSDOM(`<!DOCTYPE html><head><meta charset="UTF-8"></head>`);
    var document = dom.window.document;
    const canvas = document.createElement("canvas"); // Requires the npm package canvas in the dev environment
    const ctx = canvas.getContext("2d")!;
    ctx.font = jacketFont;
    const metrics = ctx.measureText(text);
    return metrics.width;
  }
}

try {
  /** Force download textage data or not */
  const forceDownload = !!process.argv[2];

  const targetFile = path.join(
    path.dirname(fileURLToPath(import.meta.url)),
    "../src/songs",
    "iidx.json",
  );
  const existingData: GameData = JSON.parse(
    await readFile(targetFile, { encoding: "utf-8" }),
  );

  const folderNames = existingData.meta.folders;
  if (!folderNames?.length) {
    throw new Error(
      `Missing meta.folders in ${targetFile}. Update the JSON metadata first.`,
    );
  }

  const songList = existingData.songs;

  const importer = new TextageSongImporter(forceDownload);
  const fetchedSongs = await importer.fetchSongs();
  for (const fetchedSong of fetchedSongs) {
    const existingSong = songList.find((song) =>
      importer.songEquals(song, fetchedSong),
    );
    if (existingSong) {
      importer.merge(existingSong, fetchedSong);
    } else {
      songList.push(fetchedSong);
    }
  }
  existingData.songs = songList;

  console.log(`Successfully built chart info database using textage JS`);

  for (const folderName of folderNames) {
    const fileName = folderName.replaceAll(" ", "-");
    const svgFilePath = path.join(
      path.dirname(fileURLToPath(import.meta.url)),
      "../src/assets/jackets/iidx",
      `${fileName}.svg`,
    );
    if (!(await exists(svgFilePath))) {
      console.log(`Missing jacket for ${folderName}, generating...`);
      await generateVersionFolderJacket(folderName, svgFilePath);
    }
  }

  const lastUpdated = (await importer.fetchLastUpdated()) || Date.now();
  writeJsonData(existingData, targetFile, lastUpdated);
  console.log(`Successfully imported data, writing data to ${targetFile}`);
  console.log(
    `Complete. Make sure new arena and time-locked/shop-bought exclusives are indicated manually!`,
  );
} catch (e) {
  console.error("Error updating IIDX data:", e);
  process.exitCode = 1;
}
