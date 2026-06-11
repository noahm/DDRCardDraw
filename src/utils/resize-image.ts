/**
 * Downscales an image file to fit within `maxDimension` (preserving aspect
 * ratio) and re-encodes it as a JPEG, so pack jackets/banners/backgrounds
 * stay small enough to upload and sync to other clients.
 */
export async function resizeImage(
  file: File,
  maxDimension = 300,
  quality = 0.85,
): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  try {
    const scale = Math.min(
      1,
      maxDimension / Math.max(bitmap.width, bitmap.height),
    );
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      throw new Error("failed to get canvas 2d context");
    }
    ctx.drawImage(bitmap, 0, 0, width, height);

    return await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (blob) => {
          if (blob) resolve(blob);
          else reject(new Error("failed to encode resized image"));
        },
        "image/jpeg",
        quality,
      );
    });
  } finally {
    bitmap.close();
  }
}
