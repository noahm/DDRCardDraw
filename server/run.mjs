/**
 * Bundles realtime-server.mts (and the app's redux state modules it pulls
 * in) into a single ES module with esbuild, then runs it. Bundling sidesteps
 * two issues with running the TypeScript sources directly under Node:
 * the app code uses extensionless relative imports (the normal convention
 * for code that goes through webpack), and it imports some types without
 * `import type`, which Node's type-stripping can't elide on its own.
 *
 * Usage: `node server/run.mjs` (registered as `yarn start:backend`)
 */
import { build } from "esbuild";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const outfile = join(here, ".build", "realtime-server.mjs");

await build({
  entryPoints: [join(here, "realtime-server.mts")],
  bundle: true,
  platform: "node",
  format: "esm",
  packages: "external",
  target: "node22",
  sourcemap: "inline",
  outfile,
});

await import(pathToFileURL(outfile).href);
