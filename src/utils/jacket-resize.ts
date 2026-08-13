/**
 * Base url of the content-addressed jacket pool, injected at build time
 * (webpack DefinePlugin) alongside `DATA_API_BASE`: production
 * cdn.data.ddr.tools, local wrangler dev otherwise.
 */
const CDN_BASE = process.env.CDN_BASE || "https://cdn.data.ddr.tools";

/**
 * Match what `scripts/utils.mts` does to stock jackets before they're committed
 * (jimp `.resize({ w: 128 })` + `.write(…, { quality: 80 })`), so uploaded pack
 * art lands at the same size and weight as everything else the cards render.
 */
const TARGET_WIDTH = 128;
const JPEG_QUALITY = 0.8;

export interface ResizedJacket {
  /** sha256 of the resized bytes — its own address in the pool */
  hash: string;
  blob: Blob;
}

/** Public url for a jacket already uploaded under this hash. */
export function jacketUrlForHash(hash: string): string {
  return `${CDN_BASE}/jackets/${hash}`;
}

function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) =>
        blob ? resolve(blob) : reject(new Error("failed to encode jacket")),
      "image/jpeg",
      JPEG_QUALITY,
    );
  });
}

async function sha256Hex(blob: Blob): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    await blob.arrayBuffer(),
  );
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Downscale one pack image to card size and hash the result.
 *
 * Resizing happens here rather than server-side on purpose: pack art is full
 * resolution and there can be hundreds of files, which is far more decode work
 * than a Worker can do. The hash is of the *resized* bytes, since those are what
 * get uploaded and addressed.
 */
export async function resizeAndHashJacket(file: File): Promise<ResizedJacket> {
  const bitmap = await createImageBitmap(file);
  try {
    const scale = Math.min(1, TARGET_WIDTH / bitmap.width);
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));

    const ctx = canvas.getContext("2d");
    if (!ctx) {
      throw new Error("could not get a 2d canvas context to resize jackets");
    }
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);

    const blob = await canvasToBlob(canvas);
    return { hash: await sha256Hex(blob), blob };
  } finally {
    bitmap.close();
  }
}
