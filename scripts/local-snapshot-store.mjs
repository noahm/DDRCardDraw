#!/usr/bin/env node
/**
 * A local stand-in for the R2 snapshot store, keeping room snapshots as plain
 * JSON files in a gitignored folder instead of a Cloudflare bucket.
 *
 * This is a separate process because it has to be: `partykit dev` runs the
 * server inside workerd, which has no filesystem. The party server reaches
 * this over `fetch` exactly as it reaches R2 — same `RoomSnapshot` body, same
 * `rooms/<id>/snapshot.json` key shape, minus the request signing. So the
 * two-target durability path that runs in production is the one you exercise
 * locally, with no Cloudflare account involved.
 *
 *   yarn start:backend                       # runs this next to `partykit dev`
 *   node scripts/local-snapshot-store.mjs --port 1998 --dir .snapshots
 *
 * The party server only talks to it when `LOCAL_SNAPSHOT_URL` is set (see
 * `.env.template`); this reads the same variable to pick its port, so `.env`
 * stays the one place the pair is wired together.
 *
 * Because the snapshots are plain JSON on disk, `jq` works on them directly:
 *
 *   curl -s localhost:1998 | jq                  # what rooms exist, and how big
 *   jq .seq .snapshots/rooms/myroom/snapshot.json
 *   rm -rf .snapshots/rooms/myroom              # start that room over
 */
import { createServer } from "node:http";
import {
  mkdir,
  readFile,
  readdir,
  rename,
  stat,
  unlink,
  writeFile,
} from "node:fs/promises";
import { readFileSync } from "node:fs";
import { dirname, join, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const LOG_PREFIX = "[snapshots]";
/** refuse a body larger than this rather than buffering whatever arrives */
const MAX_BODY_BYTES = 16 * 1024 * 1024;

/**
 * Minimal `.env` reader. The party server's copy of these variables is baked
 * in by partykit's own dotenv pass at build time, so this side reads the file
 * directly rather than depending on the shell having exported anything.
 */
function readDotEnv(file) {
  const vars = {};
  let contents;
  try {
    contents = readFileSync(file, "utf8");
  } catch {
    return vars;
  }
  for (const line of contents.split("\n")) {
    // `#` is not in the key character class, so comments never match
    const match = /^\s*([A-Za-z0-9_]+)\s*=\s*(.*)$/.exec(line);
    if (match) vars[match[1]] = match[2].trim().replace(/^["']|["']$/g, "");
  }
  return vars;
}

function usage() {
  console.log(`
Serve room snapshots out of a local folder, standing in for R2.

Usage:
  node scripts/local-snapshot-store.mjs [options]

Options:
  --port <number>  port to listen on (default: the port in LOCAL_SNAPSHOT_URL,
                   else 1998)
  --dir <path>     folder to keep snapshots in (default: LOCAL_SNAPSHOT_DIR,
                   else .snapshots)
  --help           show this message
`);
}

function parseArgs(argv) {
  const options = {};
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--help" || arg === "-h") options.help = true;
    else if (arg === "--port") options.port = Number(argv[++i]);
    else if (arg === "--dir") options.dir = argv[++i];
    else {
      console.error(`${LOG_PREFIX} unknown argument: ${arg}`);
      usage();
      process.exit(1);
    }
  }
  return options;
}

/** the port the party server has been told to reach us on, if anything has */
function portFromConfiguredUrl(url) {
  if (!url) return undefined;
  try {
    const parsed = new URL(url);
    return Number(parsed.port) || (parsed.protocol === "https:" ? 443 : 80);
  } catch {
    console.warn(`${LOG_PREFIX} LOCAL_SNAPSHOT_URL is not a URL: ${url}`);
    return undefined;
  }
}

const options = parseArgs(process.argv.slice(2));
if (options.help) {
  usage();
  process.exit(0);
}

const dotEnv = readDotEnv(join(repoRoot, ".env"));
const configuredUrl =
  process.env.LOCAL_SNAPSHOT_URL || dotEnv.LOCAL_SNAPSHOT_URL;
const port = options.port || portFromConfiguredUrl(configuredUrl) || 1998;
const root = resolve(
  repoRoot,
  options.dir ||
    process.env.LOCAL_SNAPSHOT_DIR ||
    dotEnv.LOCAL_SNAPSHOT_DIR ||
    ".snapshots",
);

/**
 * Map a request path onto a file, refusing anything that climbs out of the
 * snapshot folder. Room ids arrive percent-encoded and are otherwise
 * unvalidated — they come from whatever `/e/<room>` URL someone opened — so a
 * room called `../../etc/passwd` has to land on a 400, not on a write.
 */
function resolveObjectPath(pathname) {
  let decoded;
  try {
    decoded = decodeURIComponent(pathname);
  } catch {
    return undefined;
  }
  const target = resolve(root, decoded.replace(/^\/+/, ""));
  const prefix = root.endsWith(sep) ? root : root + sep;
  return target.startsWith(prefix) ? target : undefined;
}

function readBody(req) {
  return new Promise((resolvePromise, reject) => {
    const chunks = [];
    let length = 0;
    req.on("data", (chunk) => {
      length += chunk.length;
      if (length > MAX_BODY_BYTES) {
        reject(new Error(`body exceeds ${MAX_BODY_BYTES} bytes`));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => resolvePromise(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

/**
 * Write through a temp file in the same folder and rename over the target, so
 * a snapshot half-written when this process dies can't replace a good one —
 * the same all-or-nothing guarantee a `PUT` to R2 gives.
 */
async function writeAtomic(file, body) {
  await mkdir(dirname(file), { recursive: true });
  const temp = `${file}.${process.pid}.tmp`;
  try {
    await writeFile(temp, body);
    await rename(temp, file);
  } catch (e) {
    await unlink(temp).catch(() => {});
    throw e;
  }
}

/** short relative path for logs, so lines stay readable */
function forLog(file) {
  return file.startsWith(root + sep) ? file.slice(root.length + 1) : file;
}

/** what's on disk right now, for a human hitting `GET /` */
async function index() {
  const roomsDir = join(root, "rooms");
  let entries;
  try {
    entries = await readdir(roomsDir, { withFileTypes: true });
  } catch {
    entries = [];
  }
  const rooms = [];
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const file = join(roomsDir, entry.name, "snapshot.json");
    try {
      const [info, contents] = await Promise.all([
        stat(file),
        readFile(file, "utf8"),
      ]);
      const snapshot = JSON.parse(contents);
      rooms.push({
        room: decodeURIComponent(entry.name),
        bytes: info.size,
        seq: snapshot.seq,
        savedAt: snapshot.savedAt,
        drawings: snapshot.state?.drawings?.ids?.length ?? null,
        path: forLog(file),
      });
    } catch (e) {
      rooms.push({ room: decodeURIComponent(entry.name), error: String(e) });
    }
  }
  rooms.sort((a, b) => a.room.localeCompare(b.room));
  return { dir: root, rooms };
}

function sendJson(res, status, value) {
  const body = JSON.stringify(value, null, 2);
  res.writeHead(status, {
    "content-type": "application/json",
    "content-length": Buffer.byteLength(body),
  });
  res.end(body);
}

async function handle(req, res) {
  const { pathname } = new URL(req.url, `http://localhost:${port}`);

  if (req.method === "GET" && (pathname === "/" || pathname === "")) {
    sendJson(res, 200, await index());
    return;
  }

  const file = resolveObjectPath(pathname);
  if (!file) {
    console.warn(`${LOG_PREFIX} rejected path outside ${root}: ${pathname}`);
    sendJson(res, 400, { error: "path escapes the snapshot folder" });
    return;
  }

  if (req.method === "PUT") {
    const body = await readBody(req);
    await writeAtomic(file, body);
    console.log(`${LOG_PREFIX} put ${forLog(file)} ${body.length}B`);
    res.writeHead(204).end();
    return;
  }

  if (req.method === "GET") {
    let contents;
    try {
      contents = await readFile(file);
    } catch (e) {
      if (e.code === "ENOENT") {
        console.log(`${LOG_PREFIX} get ${forLog(file)} 404`);
        sendJson(res, 404, { error: "no snapshot for that room" });
        return;
      }
      throw e;
    }
    console.log(`${LOG_PREFIX} get ${forLog(file)} ${contents.length}B`);
    res.writeHead(200, {
      "content-type": "application/json",
      "content-length": contents.length,
    });
    res.end(contents);
    return;
  }

  res.writeHead(405, { allow: "GET, PUT" }).end();
}

const server = createServer((req, res) => {
  handle(req, res).catch((e) => {
    console.error(`${LOG_PREFIX} ${req.method} ${req.url} failed`, e);
    if (!res.headersSent) sendJson(res, 500, { error: String(e) });
    else res.end();
  });
});

// localhost only: this has no authentication and writes files, which is fine
// for a dev-machine stand-in and is not fine on a network interface
server.listen(port, "127.0.0.1", async () => {
  await mkdir(root, { recursive: true });
  console.log(`${LOG_PREFIX} serving ${root} on http://127.0.0.1:${port}`);
  if (configuredUrl) {
    console.log(`${LOG_PREFIX} party server configured for ${configuredUrl}`);
  } else {
    console.log(
      `${LOG_PREFIX} LOCAL_SNAPSHOT_URL is unset, so the party server will not use this. Add "LOCAL_SNAPSHOT_URL=http://127.0.0.1:${port}" to .env and restart.`,
    );
  }
});

server.on("error", (e) => {
  if (e.code === "EADDRINUSE") {
    console.error(
      `${LOG_PREFIX} port ${port} is already in use — another copy of this is probably still running`,
    );
    process.exit(1);
  }
  throw e;
});
