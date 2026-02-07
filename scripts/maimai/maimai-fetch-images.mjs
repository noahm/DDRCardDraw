/* eslint-disable no-await-in-loop */
import fs from "fs";
import path from "path";
import https from "node:https";
import PQueue from "p-queue";
import download from "download";
import { Jimp, ResizeStrategy } from "jimp";

/**
 * Downloads jackets for MaiMai songs and appends the correct `jacket` field.
 * @param {Array} songs - Array of raw song objects from the MaiMai database
 */
export async function fetchMaimaiJackets(songs) {
  const coverImgDir = path.resolve("src/assets/jackets/maimai");

  // Ensure directory exists
  if (!fs.existsSync(coverImgDir)) {
    fs.mkdirSync(coverImgDir, { recursive: true });
  }

  // Queue to limit concurrency
  const requestQueue = new PQueue({
    concurrency: 6, // max 6 simultaneous downloads
    interval: 1000,
    intervalCap: 10, // max 10 requests per second
  });

  console.info("📥 Downloading and resizing MaiMai jackets...");

  for (const [index, song] of songs.entries()) {
    if (!song.imageName) continue;

    const jacketName = `${index + 1}.png`; // Japanese Jacket Titles Broke Webserver, changed songIDs to Index
    const jacketPath = path.join(coverImgDir, jacketName);

    // Skip download if file already exists
    if (!fs.existsSync(jacketPath)) {
      console.info(
        `(${index + 1}/${songs.length}) ${song.title} -> ${jacketName}`,
      );

      requestQueue.add(async () => {
        try {
          await download(song.imageName, coverImgDir, {
            filename: jacketName,
            headers: {},
            rejectUnauthorized: false,
          });
          // Resize with Jimp, minimal change from utils.mts style
          await Jimp.read(jacketPath).then((img) =>
            img
              .resize({ w: 128, mode: ResizeStrategy.BILINEAR })
              .write(jacketPath, { quality: 80 }),
          );
        } catch (err) {
          console.warn(
            `⚠️ Failed to download /  jacket for ${song.title}:`,
            err.message,
          );
        }
      });
    }

    // Assign jacket path relative to assets folder
    song.jacket = `maimai/${jacketName}`;
  }

  // Wait until all downloads complete
  await requestQueue.onIdle();

  console.info("✅ All jackets processed!");
}

/**
 * Simple filename sanitizer to remove characters invalid for filesystems
 * @param {string} name
 */
