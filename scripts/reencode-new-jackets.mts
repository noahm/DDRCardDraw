/**
 * Re-encodes jackets added on the current branch (compared to main) to the
 * same size and quality used by the import scripts. Useful when jackets were
 * added by hand instead of through `downloadJacket`.
 *
 * Images already at the standard width are skipped, so this is safe to re-run.
 *
 * Usage: yarn reencode:jackets [base-ref]   (base-ref defaults to main)
 */
import { execFileSync } from "node:child_process";
import { stat } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { Jimp } from "jimp";
import { JACKET_WIDTH, writeJacket } from "./utils.mts";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, "..");
const JACKETS_DIR = "src/assets/jackets";

const baseRef = process.argv[2] || "main";

function git(...args: string[]) {
  return execFileSync("git", args, { cwd: REPO_ROOT, encoding: "utf-8" });
}

const mergeBase = git("merge-base", baseRef, "HEAD").trim();
// diffing against the merge base (not HEAD) also picks up uncommitted changes
const added = git(
  "diff",
  "--name-only",
  "--diff-filter=A",
  mergeBase,
  "--",
  JACKETS_DIR,
)
  .split("\n")
  .filter(Boolean);

const jpgs = added.filter((f) => f.endsWith(".jpg"));
for (const other of added.filter((f) => !f.endsWith(".jpg"))) {
  console.warn(`Skipping ${other}: jackets must be .jpg`);
}

let totalBefore = 0;
let totalAfter = 0;
let reencoded = 0;

for (const file of jpgs) {
  const absolute = resolve(REPO_ROOT, file) as `${string}.jpg`;
  try {
    const before = (await stat(absolute)).size;
    const img = await Jimp.read(absolute);
    if (img.width === JACKET_WIDTH) {
      console.log(`Skipping ${file}: already ${JACKET_WIDTH}px wide`);
      continue;
    }
    const prevDims = `${img.width}x${img.height}`;
    await writeJacket(img, absolute);
    const after = (await stat(absolute)).size;
    totalBefore += before;
    totalAfter += after;
    reencoded++;
    console.log(
      `${file}: ${prevDims} → ${img.width}x${img.height}, ${(before / 1024).toFixed(1)}kb → ${(after / 1024).toFixed(1)}kb`,
    );
  } catch (e) {
    console.error(`Failed to process ${file}`, e);
    process.exitCode = 1;
  }
}

console.log(
  `Re-encoded ${reencoded} of ${jpgs.length} added jackets (${(totalBefore / 1024).toFixed(0)}kb → ${(totalAfter / 1024).toFixed(0)}kb)`,
);
