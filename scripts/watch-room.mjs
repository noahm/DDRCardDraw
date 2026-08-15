#!/usr/bin/env node
/**
 * Watch the deployed party server's logs for a single event room.
 *
 * Wraps `partykit tail`, which supports a server-side `--search` text filter.
 * Every diagnostic line the server emits carries `room=<id>`, so searching for
 * that string narrows the firehose to one event. The room id is the `:roomName`
 * segment of an event URL, so you can paste the whole link a reporter sent you.
 *
 *   node scripts/watch-room.mjs https://ddrdraw.surge.sh/#/e/abc123
 *   node scripts/watch-room.mjs abc123
 *   yarn watch:room abc123
 *
 * Beyond filtering, this correlates the lines to answer the question the
 * logging was added for: did the persisted snapshot stop advancing? It flags
 * when a room restarts holding unconfirmed storage writes, and when a restart
 * hydrates a snapshot that doesn't match the last state we saw applied.
 *
 * A tail session expires server-side and the partykit CLI does not reconnect,
 * so this restarts it automatically and marks the gap. Tail has no backfill:
 * anything logged during a gap is gone, which is why gaps are printed rather
 * than papered over, and why findings that straddle one are qualified.
 */
import { spawn } from "node:child_process";
import { dirname, join, resolve } from "node:path";
import { createWriteStream, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

const DIAG_PREFIX = "[party-diag]";
/** `[party-diag] room=<id> <event> <details...>` */
const DIAG_LINE = /^\[party-diag\] room=(\S+) (\S+)(?: ([\s\S]*))?$/;
/** the state fingerprint the server stamps onto most lines */
const FINGERPRINT = /drawings=\d+ stateLen=-?\d+/;

const color = process.stdout.isTTY
  ? {
      dim: (s) => `\x1b[2m${s}\x1b[0m`,
      red: (s) => `\x1b[31m${s}\x1b[0m`,
      yellow: (s) => `\x1b[33m${s}\x1b[0m`,
      green: (s) => `\x1b[32m${s}\x1b[0m`,
      cyan: (s) => `\x1b[36m${s}\x1b[0m`,
      bold: (s) => `\x1b[1m${s}\x1b[0m`,
    }
  : new Proxy({}, { get: () => (s) => s });

function usage() {
  console.log(`
Watch one event room's party server logs.

Usage:
  node scripts/watch-room.mjs <room-id-or-event-url> [options] [-- <partykit args>]

Options:
  --out <file>   append the timeline to a file as well (no colour codes), so
                 it can be parked for a whole event and read afterwards
  --no-reconnect do not restart the tail when it drops
  --verbose      also show non-diagnostic log lines from matching invocations
  --raw          print raw tail JSON instead of the digested timeline
  --all          skip the exact client-side room match (keep every matched
                 invocation, even if another room's line tripped the search)
  -h, --help     show this

Anything after \`--\` is passed through to \`partykit tail\`, e.g.:
  node scripts/watch-room.mjs abc123 -- --preview my-preview
`);
}

/** accepts a bare id, a path, or a full event URL (hash routes included) */
function extractRoomId(input) {
  const match = /\/e\/([^/?#\s]+)/.exec(input);
  return decodeURIComponent(match ? match[1] : input);
}

const argv = process.argv.slice(2);
if (!argv.length || argv.includes("-h") || argv.includes("--help")) {
  usage();
  process.exit(argv.length ? 0 : 1);
}

const passThroughAt = argv.indexOf("--");
const ownArgs = passThroughAt === -1 ? argv : argv.slice(0, passThroughAt);
const tailArgs = passThroughAt === -1 ? [] : argv.slice(passThroughAt + 1);

// pull `--out <file>` out before the rest, since it takes a value
const outAt = ownArgs.indexOf("--out");
let outPath = null;
if (outAt !== -1) {
  outPath = ownArgs[outAt + 1];
  if (!outPath || outPath.startsWith("-")) {
    console.error("error: --out requires a file path\n");
    usage();
    process.exit(1);
  }
  ownArgs.splice(outAt, 2);
}

const flags = new Set(ownArgs.filter((a) => a.startsWith("-")));
const positional = ownArgs.filter((a) => !a.startsWith("-"));
if (!positional.length) {
  console.error("error: a room id or event URL is required\n");
  usage();
  process.exit(1);
}

const roomId = extractRoomId(positional[0]);
const verbose = flags.has("--verbose");
const raw = flags.has("--raw");
const matchExactRoom = !flags.has("--all");
const reconnect = !flags.has("--no-reconnect");

/** how long a tail must survive before we treat the connection as healthy */
const HEALTHY_MS = 10_000;
/** consecutive immediate failures before giving up (bad auth, wrong project) */
const MAX_FAILURES = 5;

const outStream = outPath ? createWriteStream(outPath, { flags: "a" }) : null;
const ANSI = /\x1b\[[0-9;]*m/g;

/** write one line to stdout (with colour) and to --out (without) */
function emit(line) {
  console.log(line);
  if (outStream) outStream.write(`${line.replace(ANSI, "")}\n`);
}

const localBin = resolve(
  join(__dirname, "..", "node_modules", ".bin", "partykit"),
);
const partykitBin = existsSync(localBin) ? localBin : "partykit";

console.error(
  color.bold(`watching room ${roomId}`) +
    color.dim(` (via ${partykitBin} tail --search "room=${roomId}")`),
);
if (outStream) console.error(color.dim(`appending timeline to ${outPath}`));
console.error(color.dim("ctrl-c to stop and print a summary\n"));

if (outStream) {
  outStream.write(
    `\n=== watch-room session started ${new Date().toISOString()} room=${roomId} ===\n`,
  );
}

/** running tallies, reported on exit */
const counts = new Map();
const alerts = [];
/** number of times the tail dropped and was restarted */
let reconnects = 0;
/**
 * set when a tail gap means we may have missed events since the current
 * baseline was established; cleared once a fresh action re-establishes it.
 * Findings that depend on the baseline are qualified while this is set.
 */
let gapSinceBaseline = false;
/** puts that were in flight when a gap began: they may have settled unseen */
let putsUnknown = 0;
/** working baseline: the state we believe is current, re-based on each onStart */
let lastApplied = null;
let lastAppliedSeq = null;
/** high-water mark: the last state a handleAction actually produced */
let lastAction = null;
let lastActionSeq = null;
/** storage writes started but not yet seen confirmed on this room instance */
let unconfirmedPuts = 0;
let putStarts = 0;
let putSettled = 0;

function tally(key) {
  counts.set(key, (counts.get(key) ?? 0) + 1);
}

function alert(message, dependsOnBaseline = false) {
  const qualified =
    dependsOnBaseline && gapSinceBaseline
      ? `${message} [uncertain: the tail dropped since the last observed action, so events may have been missed]`
      : message;
  alerts.push(qualified);
  emit(`${color.red("!! ALERT")} ${qualified}`);
}

function fingerprintOf(details) {
  const match = FINGERPRINT.exec(details ?? "");
  return match ? match[0] : null;
}

function fieldOf(details, name) {
  const match = new RegExp(`${name}=(\\S+)`).exec(details ?? "");
  return match ? match[1] : null;
}

function stamp(ms) {
  const d = ms ? new Date(ms) : new Date();
  return color.dim(d.toISOString().slice(11, 19));
}

/** render one console.log argument from a tail event */
function formatPart(part) {
  if (typeof part === "string") return part;
  try {
    return JSON.stringify(part);
  } catch {
    return String(part);
  }
}

function handleDiagLine(text, ts) {
  const match = DIAG_LINE.exec(text);
  if (!match) return false;
  const [, room, event, details = ""] = match;
  if (matchExactRoom && room !== roomId) return true;

  tally(event);
  const fingerprint = fingerprintOf(details);

  const isError =
    event.endsWith(":error") ||
    event.endsWith(":throw") ||
    event === "onError" ||
    event === "onStart:hydrate-error";
  if (isError) {
    alert(`${event} ${details}`);
    // still settle the write below so the confirmed tally stays accurate
    if (event === "storage.put:error") {
      putSettled += 1;
      unconfirmedPuts = Math.max(0, unconfirmedPuts - 1);
    }
    return true;
  }

  // print the line before analysing it, so any alert reads as a consequence
  const label = event.padEnd(20);
  const tint = event === "handleAction" ? color.cyan : color.dim;
  emit(`${stamp(ts)} ${tint(label)} ${details}`);

  switch (event) {
    case "handleAction":
      lastApplied = fingerprint ?? lastApplied;
      lastAppliedSeq = fieldOf(details, "seq") ?? lastAppliedSeq;
      lastAction = lastApplied;
      lastActionSeq = lastAppliedSeq;
      // a freshly observed action gives us a trustworthy baseline again
      gapSinceBaseline = false;
      break;

    case "storage.put:start":
      putStarts += 1;
      unconfirmedPuts += 1;
      break;

    case "storage.put:ok":
      putSettled += 1;
      unconfirmedPuts = Math.max(0, unconfirmedPuts - 1);
      break;

    case "onStart": {
      // a fresh instance means the previous one went away: anything it had in
      // flight never reported back, which is the eviction/flush suspicion.
      if (unconfirmedPuts > 0) {
        alert(
          `room restarted with ${unconfirmedPuts} storage write(s) never confirmed — ` +
            `writes may not be flushing before eviction`,
          true,
        );
      }
      if (lastApplied && fingerprint && fingerprint !== lastApplied) {
        alert(
          `hydrated snapshot does not match last applied state — ` +
            `SNAPSHOT REVERTED (last applied: ${lastApplied} seq=${lastAppliedSeq}; ` +
            `hydrated from ${fieldOf(details, "source")}: ${fingerprint})`,
          true,
        );
      }
      // re-baseline against the new instance
      unconfirmedPuts = 0;
      lastApplied = fingerprint;
      lastAppliedSeq = fieldOf(details, "seq");
      break;
    }

    case "onConnect":
      if (lastApplied && fingerprint && fingerprint !== lastApplied) {
        alert(
          `serving a roomstate that differs from the last applied state ` +
            `(last applied: ${lastApplied}; serving: ${fingerprint})`,
          true,
        );
      }
      break;

    default:
      break;
  }

  return true;
}

function handleEvent(evt) {
  const eventTs = evt.eventTimestamp;

  if (evt.outcome && evt.outcome !== "ok") {
    tally(`outcome:${evt.outcome}`);
    alert(`invocation outcome=${evt.outcome} (room may have been torn down)`);
  }

  for (const ex of Array.isArray(evt.exceptions) ? evt.exceptions : []) {
    tally("exception");
    alert(`uncaught ${ex.name ?? "exception"}: ${ex.message ?? ""}`);
  }

  for (const log of Array.isArray(evt.logs) ? evt.logs : []) {
    const parts = Array.isArray(log.message) ? log.message : [log.message];
    const text = parts.map(formatPart).join(" ");
    const ts = log.timestamp ?? eventTs;

    if (text.startsWith(DIAG_PREFIX)) {
      handleDiagLine(text, ts);
    } else if (verbose) {
      emit(`${stamp(ts)} ${color.dim("(other)".padEnd(20))} ${text}`);
    }
  }
}

// `partykit tail -f json` emits JSON.stringify(event, null, 2) per event, so a
// top-level closing brace at column 0 delimits each one.
let buffer = "";

function onChunk(chunk) {
  if (raw) {
    process.stdout.write(chunk);
    return;
  }
  buffer += chunk;
  let end;
  while ((end = buffer.indexOf("\n}\n")) !== -1) {
    const block = buffer.slice(0, end + 2);
    buffer = buffer.slice(end + 3);
    try {
      handleEvent(JSON.parse(block));
    } catch {
      // a partial or unexpected payload: surface it rather than dying
      console.error(color.yellow(`(could not parse tail event)`));
    }
  }
}

function summarize() {
  emit(`\n${color.bold(`summary for room ${roomId}`)}`);
  if (counts.size) {
    for (const [event, n] of [...counts].sort((a, b) => b[1] - a[1])) {
      emit(`  ${String(n).padStart(5)}  ${event}`);
    }
  } else {
    emit(color.dim("  no matching log lines seen"));
  }

  const unsettled = putStarts - putSettled - putsUnknown;
  // only claim everything is accounted for when nothing is unsettled *and*
  // nothing was left in an unknown state by a tail gap
  let writeVerdict = "";
  if (unsettled > 0) {
    writeVerdict = color.red(
      ` — ${unsettled} never settled (likely lost to eviction)`,
    );
  } else if (putsUnknown === 0) {
    writeVerdict = color.green(" — all accounted for");
  }
  emit(
    `\n  storage writes: ${putStarts} started, ${putSettled} reported back${writeVerdict}`,
  );
  if (putsUnknown > 0) {
    emit(
      color.yellow(
        `  ${putsUnknown} write(s) were in flight when the tail dropped — outcome unknown`,
      ),
    );
  }
  if (lastAction) {
    emit(
      `  last state applied by an action: ${lastAction} seq=${lastActionSeq}`,
    );
  }
  if (lastApplied && lastApplied !== lastAction) {
    emit(
      color.red(
        `  currently serving:              ${lastApplied} seq=${lastAppliedSeq}`,
      ),
    );
  }
  if (reconnects > 0) {
    emit(
      color.yellow(
        `  tail dropped and reconnected ${reconnects} time(s) — logs during those gaps were not captured`,
      ),
    );
  }

  if (alerts.length) {
    emit(`\n${color.red(`${alerts.length} alert(s):`)}`);
    for (const a of alerts) emit(`  - ${a}`);
  } else {
    emit(`\n${color.green("no alerts raised")}`);
  }
}

// ---- tail supervisor: the CLI exits when its session expires, so respawn it

let child = null;
let closing = false;
/** consecutive failures where the tail died before reaching HEALTHY_MS */
let failures = 0;
let startedAt = 0;

function finish(code) {
  summarize();
  if (outStream) {
    outStream.end(
      `=== watch-room session ended ${new Date().toISOString()} ===\n`,
      () => process.exit(code),
    );
  } else {
    process.exit(code);
  }
}

function spawnTail() {
  startedAt = Date.now();
  buffer = "";
  child = spawn(
    partykitBin,
    ["tail", "-f", "json", "--search", `room=${roomId}`, ...tailArgs],
    { stdio: ["ignore", "pipe", "inherit"] },
  );
  child.stdout.setEncoding("utf8");
  child.stdout.on("data", onChunk);

  child.on("error", (err) => {
    console.error(color.red(`failed to run ${partykitBin}: ${err.message}`));
    finish(1);
  });

  child.on("close", (code) => {
    if (closing) {
      finish(code ?? 0);
      return;
    }
    if (!reconnect) {
      emit(color.yellow(`tail exited (code ${code}); --no-reconnect set`));
      finish(code ?? 0);
      return;
    }

    const lived = Date.now() - startedAt;
    failures = lived < HEALTHY_MS ? failures + 1 : 0;
    if (failures >= MAX_FAILURES) {
      emit(
        color.red(
          `tail exited ${failures} times in a row without staying up — giving up. ` +
            `Check that \`${partykitBin} tail\` works on its own (login, project name).`,
        ),
      );
      finish(1);
      return;
    }

    // anything still in flight may have settled unseen during the gap, so
    // move it out of the "never settled" tally rather than alerting on it
    if (unconfirmedPuts > 0) {
      putsUnknown += unconfirmedPuts;
      unconfirmedPuts = 0;
    }
    gapSinceBaseline = true;
    reconnects += 1;

    const delay = Math.min(30_000, 1000 * 2 ** failures);
    emit(
      color.yellow(
        `--- tail dropped at ${new Date().toISOString().slice(11, 19)} (code ${code}); ` +
          `reconnecting in ${Math.round(delay / 1000)}s — events during the gap are lost ---`,
      ),
    );
    setTimeout(() => {
      emit(
        color.yellow(
          `--- tail reconnected at ${new Date().toISOString().slice(11, 19)} ---`,
        ),
      );
      spawnTail();
    }, delay);
  });
}

function shutdown() {
  if (closing) return;
  closing = true;
  if (child) child.kill("SIGINT");
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

spawnTail();
