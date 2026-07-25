#!/usr/bin/env node
/**
 * Rehearse the roadmap step 2.5 migration: does a party deployment with empty
 * room storage pick a room back up from the shared Supabase backend?
 *
 * The claim under test (docs/partykit-sync-roadmap.md, step 2.5) is that
 * `onStart`'s `storage -> supabase -> fresh` fallback chain *is* the migration
 * mechanism: point a brand-new deployment at the same Supabase project and
 * each room rehydrates from it on first connect, with no export tooling. If
 * that holds, moving off managed PartyKit is a redeploy rather than a data
 * migration.
 *
 * The rehearsal runs two real party deployments — same code, same shared
 * backend, *different* `--persist` directories — and drives them over real
 * websockets:
 *
 *   deployment A  = the managed deployment we are leaving  (has room storage)
 *   deployment B  = the self-hosted deployment we move to  (storage empty)
 *
 * Supabase itself is stood in for by `shared-backend.mjs`, which speaks the
 * PostgREST subset the server uses. That keeps the rehearsal credential-free
 * and tests *our* behaviour, which is the part actually in question.
 *
 * Usage:
 *   node scripts/migration-rehearsal/rehearse.mjs [--verbose] [--keep]
 *
 * Exits non-zero if any check fails.
 */
import { spawn } from "node:child_process";
import { rm, mkdir } from "node:fs/promises";
import { setTimeout as sleep } from "node:timers/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { connect } from "node:net";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "../..");

const argv = process.argv.slice(2);
const verbose = argv.includes("--verbose");
const keepArtifacts = argv.includes("--keep");

const BACKEND_PORT = 54329;
const BACKEND_KEY = "rehearsal-key";
const PORT_A = 1999;
const PORT_B = 2999;
const PORT_C = 3999;
const ROOM = "migration-rehearsal";
/** a room the rehearsal never writes to, to prove hydration is keyed by id */
const UNTOUCHED_ROOM = "never-written";
/** polled for readiness so the room under test is not instantiated early */
const READINESS_ROOM = "readiness-probe";

const workDir = resolve(repoRoot, ".rehearsal");

const children = [];
const results = [];

// ---------------------------------------------------------------- utilities

const ANSI = /\x1b\[[0-9;]*[A-Za-z]/g;

function log(...parts) {
  console.log(...parts);
}

function debug(...parts) {
  if (verbose) console.log("   ·", ...parts);
}

function check(name, passed, detail = "") {
  results.push({ name, passed, detail });
  const mark = passed ? "\x1b[32mPASS\x1b[0m" : "\x1b[31mFAIL\x1b[0m";
  log(`  [${mark}] ${name}${detail ? ` — ${detail}` : ""}`);
}

/** a finding is an observation, not a pass/fail — recorded for the writeup */
function finding(name, detail) {
  results.push({ name, finding: true, detail });
  log(`  [\x1b[33mNOTE\x1b[0m] ${name} — ${detail}`);
}

function startProcess(label, command, args, extraEnv = {}) {
  const child = spawn(command, args, {
    cwd: repoRoot,
    // own process group: partykit spawns a workerd child that actually holds
    // the port, and killing only the node wrapper leaves it running
    detached: true,
    env: { ...process.env, ...extraEnv },
    stdio: ["ignore", "pipe", "pipe"],
  });
  const record = { label, child, lines: [] };
  const collect = (buf) => {
    for (const raw of String(buf).split("\n")) {
      const line = raw.replace(ANSI, "").trim();
      if (!line) continue;
      record.lines.push(line);
      if (verbose) console.log(`   [${label}] ${line}`);
    }
  };
  child.stdout.on("data", collect);
  child.stderr.on("data", collect);
  children.push(record);
  return record;
}

function signalGroup(record, signal) {
  try {
    process.kill(-record.child.pid, signal);
    return true;
  } catch {
    try {
      record.child.kill(signal);
      return true;
    } catch {
      return false; /* already gone */
    }
  }
}

function stopProcess(record) {
  if (!record || record.child.killed) return;
  signalGroup(record, "SIGTERM");
}

/**
 * Stop a deployment and do not return until its port is actually free.
 *
 * SIGTERM alone is not enough: the `workerd` grandchild routinely outlives it
 * and keeps holding the port, which strands the next run behind the
 * `assertPortFree` pre-flight (and, before that check existed, silently
 * corrupted the results). Escalate to SIGKILL and confirm the port let go.
 */
async function stopDeployment(record, port) {
  stopProcess(record);
  const deadline = Date.now() + 15_000;
  let escalated = false;
  while (Date.now() < deadline) {
    await sleep(500);
    try {
      await assertPortFree(port, record.label);
      return;
    } catch {
      if (!escalated && Date.now() > deadline - 10_000) {
        signalGroup(record, "SIGKILL");
        escalated = true;
      }
    }
  }
  log(
    `  warning: ${record.label} would not release port ${port}; ` +
      `check \`pgrep -af workerd\` before re-running`,
  );
}

/**
 * Refuse to run against a port something else already holds.
 *
 * This is not paranoia: `partykit dev` spawns a `workerd` child that actually
 * owns the port, and killing only the node wrapper leaves it serving. A
 * survivor from an earlier run answers readiness checks and `?debug` happily
 * while being wired to a *different* backend, so the rehearsal silently grades
 * a server it did not start and the results are fiction. Cost us a debugging
 * round; hence the pre-flight.
 */
function assertPortFree(port, label) {
  return new Promise((resolvePromise, reject) => {
    const socket = connect({ host: "127.0.0.1", port });
    const giveUp = (fn) => {
      socket.destroy();
      fn();
    };
    socket.setTimeout(1500);
    socket.on("connect", () =>
      giveUp(() =>
        reject(
          new Error(
            `port ${port} (${label}) is already in use — something is still listening.\n` +
              `  A stray workerd from a previous run is the usual cause. Check with:\n` +
              `    pgrep -af workerd\n` +
              `  and kill it before re-running.`,
          ),
        ),
      ),
    );
    socket.on("timeout", () => giveUp(resolvePromise));
    socket.on("error", () => giveUp(resolvePromise));
  });
}

async function waitForHttp(url, timeoutMs, label) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(url);
      if (res.ok) return true;
    } catch {
      /* not up yet */
    }
    await sleep(500);
  }
  throw new Error(`${label} never became ready at ${url}`);
}

/** boot one party deployment against the shared backend */
async function startDeployment(label, port, persistDir) {
  log(`\n▸ booting ${label} (port ${port}, storage ${persistDir})`);
  await assertPortFree(port, label);
  const record = startProcess(label, "npx", [
    "partykit",
    "dev",
    "--port",
    String(port),
    "--persist",
    persistDir,
    // the sandbox cannot reach Cloudflare's cf endpoint; the placeholder is fine
    "--disable-request-cf-fetch",
    // `--var` populates room.env, but the server reads `process.env` at module
    // scope, so the values have to be substituted at build time instead
    "--define",
    `process.env.SUPABASE_URL="http://127.0.0.1:${BACKEND_PORT}"`,
    `process.env.SUPABASE_KEY="${BACKEND_KEY}"`,
  ]);
  await waitForHttp(
    `http://127.0.0.1:${port}/parties/main/${READINESS_ROOM}`,
    120_000,
    label,
  );
  if (record.lines.some((l) => l.includes("Disabling subpabase persistence"))) {
    throw new Error(
      `${label} did not receive the shared-backend config — the env injection broke`,
    );
  }
  // positive proof that the server answering on this port is the child we
  // spawned: it has to have logged the readiness room's own startup. Poll for
  // it rather than checking once — the HTTP response beats the child's stdout
  // reaching us, and checking instantly gives a false accusation.
  const identityDeadline = Date.now() + 10_000;
  while (
    !record.lines.some((l) => l.includes(`room=${READINESS_ROOM}`)) &&
    Date.now() < identityDeadline
  ) {
    await sleep(250);
  }
  if (!record.lines.some((l) => l.includes(`room=${READINESS_ROOM}`))) {
    throw new Error(
      `${label} answered on port ${port} but produced no diagnostics for the ` +
        `readiness probe — the responding server is not the one we started`,
    );
  }
  log(`  ${label} ready`);
  return record;
}

/** diagnostic lines this deployment emitted for a given room */
function diagLines(record, room) {
  return record.lines.filter((l) => l.includes(`[party-diag] room=${room} `));
}

// ------------------------------------------------------------ ws client

/**
 * Minimal client speaking the wire protocol from src/party/types.ts. Not
 * SyncManager — deliberately dumb, so the rehearsal observes what the *server*
 * does rather than what the client's replication layer papers over.
 */
class RehearsalClient {
  constructor(port, room) {
    this.url = `ws://127.0.0.1:${port}/parties/main/${room}`;
    this.socket = null;
    this.roomstate = null;
    /** resolvers keyed by the message id we are waiting to be confirmed */
    this.pending = new Map();
    this.messages = [];
  }

  connect(timeoutMs = 20_000) {
    return new Promise((resolvePromise, reject) => {
      const timer = setTimeout(
        () => reject(new Error(`timed out connecting to ${this.url}`)),
        timeoutMs,
      );
      this.socket = new WebSocket(this.url);
      this.socket.addEventListener("message", (event) => {
        let parsed;
        try {
          parsed = JSON.parse(event.data);
        } catch {
          return;
        }
        this.messages.push(parsed);
        debug(`recv ${parsed.type}${parsed.seq ? ` seq=${parsed.seq}` : ""}`);
        if (parsed.type === "roomstate") {
          this.roomstate = parsed;
          clearTimeout(timer);
          resolvePromise(parsed);
        }
        // the stamped echo doubles as the receipt confirmation
        const settle = parsed.id && this.pending.get(parsed.id);
        if (settle && (parsed.type === "action" || parsed.type === "ack")) {
          this.pending.delete(parsed.id);
          settle(parsed);
        }
      });
      this.socket.addEventListener("error", () => {
        clearTimeout(timer);
        reject(new Error(`websocket error against ${this.url}`));
      });
    });
  }

  /** send an action and resolve when the server confirms it */
  send(action, messageId, timeoutMs = 10_000) {
    return new Promise((resolvePromise, reject) => {
      const timer = setTimeout(
        () => reject(new Error(`no confirmation for message ${messageId}`)),
        timeoutMs,
      );
      this.pending.set(messageId, (msg) => {
        clearTimeout(timer);
        resolvePromise(msg);
      });
      this.socket.send(
        JSON.stringify({ type: "action", action, id: messageId }),
      );
    });
  }

  close() {
    try {
      this.socket?.close();
    } catch {
      /* already closed */
    }
  }
}

function addCabAction(name, cabId) {
  return { type: "event/addCab", payload: { name, id: cabId } };
}

async function debugSnapshot(port, room) {
  const res = await fetch(
    `http://127.0.0.1:${port}/parties/main/${room}?debug`,
  );
  return res.json();
}

async function backendDump() {
  const res = await fetch(`http://127.0.0.1:${BACKEND_PORT}/__admin/dump`);
  return res.json();
}

async function setBackendFailure({ reads = false, writes = false }) {
  await fetch(
    `http://127.0.0.1:${BACKEND_PORT}/__admin/fail?reads=${reads}&writes=${writes}`,
  );
}

function cabNames(state) {
  return Object.values(state?.event?.cabs ?? {})
    .map((c) => c.name)
    .sort();
}

// ------------------------------------------------------------------ phases

async function main() {
  log("\n=== step 2.5 migration rehearsal ===");
  log("Testing: does a deployment with empty room storage recover a room");
  log("from the shared backend alone?\n");

  if (!keepArtifacts) await rm(workDir, { recursive: true, force: true });
  await mkdir(workDir, { recursive: true });

  // ---- phase 0: the shared backend both deployments will talk to
  log("▸ starting shared backend stand-in");
  await assertPortFree(BACKEND_PORT, "shared backend");
  startProcess("backend", process.execPath, [
    resolve(__dirname, "shared-backend.mjs"),
    "--port",
    String(BACKEND_PORT),
    "--key",
    BACKEND_KEY,
    ...(verbose ? ["--verbose"] : []),
  ]);
  await waitForHttp(
    `http://127.0.0.1:${BACKEND_PORT}/__admin/dump`,
    15_000,
    "shared backend",
  );
  log("  backend ready");

  // ---- phase 1: run an "event" on deployment A
  const deploymentA = await startDeployment(
    "deployment-A",
    PORT_A,
    resolve(workDir, "storage-a"),
  );

  log("\n▸ phase 1: running an event on deployment A");
  const clientA = new RehearsalClient(PORT_A, ROOM);
  await clientA.connect();
  check(
    "A serves a roomstate on connect",
    clientA.roomstate?.type === "roomstate",
    `seq=${clientA.roomstate?.seq}`,
  );

  const appliedIds = [];
  for (let i = 1; i <= 3; i++) {
    const messageId = `rehearsal-msg-${i}`;
    const confirmation = await clientA.send(
      addCabAction(`Rehearsal Cab ${i}`, `cab-${i}`),
      messageId,
    );
    appliedIds.push({ messageId, seq: confirmation.seq });
  }
  log(
    `  applied ${appliedIds.length} actions, last seq=${appliedIds.at(-1).seq}`,
  );

  const snapshotA = await debugSnapshot(PORT_A, ROOM);
  const stateA = await (
    await fetch(`http://127.0.0.1:${PORT_A}/parties/main/${ROOM}`)
  ).json();
  const cabsA = cabNames(stateA);
  check(
    "A applied the actions",
    cabsA.length === 4,
    `cabs=[${cabsA.join(", ")}]`,
  );

  // ---- phase 2: the shared backend actually received it
  log("\n▸ phase 2: verifying the shared backend holds the room");
  const dump = await backendDump();
  const row = dump.find((r) => r.id === ROOM);
  check("shared backend has a row for the room", !!row, `rows=${dump.length}`);
  check(
    "backend row matches A's in-memory state",
    JSON.stringify(row?.state) === JSON.stringify(stateA),
    row ? `updated_at=${row.updated_at}` : "no row",
  );
  check(
    "A reports its supabase writes landing",
    snapshotA.writes?.supabase?.ok > 0 &&
      snapshotA.writes.supabase.failed === 0,
    `ok=${snapshotA.writes?.supabase?.ok} failed=${snapshotA.writes?.supabase?.failed}`,
  );

  clientA.close();
  await sleep(500);

  // ---- phase 3: decommission A, exactly as a cutover would
  log("\n▸ phase 3: shutting deployment A down (the cutover)");
  await stopDeployment(deploymentA, PORT_A);
  log("  A stopped");

  // ---- phase 4: bring up B with EMPTY storage against the same backend
  const deploymentB = await startDeployment(
    "deployment-B",
    PORT_B,
    resolve(workDir, "storage-b"),
  );

  log("\n▸ phase 4: connecting to the room on deployment B");
  const clientB = new RehearsalClient(PORT_B, ROOM);
  await clientB.connect();
  const stateB = clientB.roomstate.state;
  const cabsB = cabNames(stateB);

  check(
    "B recovered the room without any room storage",
    JSON.stringify(cabsB) === JSON.stringify(cabsA),
    `cabs=[${cabsB.join(", ")}]`,
  );
  check(
    "B's full state matches A's",
    JSON.stringify(stateB) === JSON.stringify(stateA),
    JSON.stringify(stateB) === JSON.stringify(stateA)
      ? "byte-identical"
      : "STATES DIFFER — see .rehearsal/ for both",
  );

  const hydrationLine = diagLines(deploymentB, ROOM).find((l) =>
    l.includes("onStart"),
  );
  check(
    "B hydrated from the shared backend (not fresh)",
    !!hydrationLine?.includes("source=supabase"),
    hydrationLine ?? "no onStart line captured",
  );

  // ---- phase 5: what did NOT come across
  log("\n▸ phase 5: what the shared backend does not carry");
  const snapshotB = await debugSnapshot(PORT_B, ROOM);
  finding(
    "sequencer position resets",
    `A ended at seq=${snapshotA.seq}, B restarted at seq=${clientB.roomstate.seq} — syncMeta lives only in room storage`,
  );
  finding(
    "dedupe set is empty after migration",
    `B reports recentActionIds=${clientB.roomstate.recentActionIds?.length ?? 0} (A had ${snapshotA.rememberedActionIds})`,
  );

  // ---- phase 6: does the empty dedupe set let a re-send double-apply?
  log("\n▸ phase 6: probing the re-send hazard");
  const replayId = appliedIds[0].messageId;
  const cabsBeforeReplay = cabNames(clientB.roomstate.state).length;
  await clientB.send(addCabAction("Rehearsal Cab 1", "cab-1"), replayId);
  await sleep(1000);
  const stateAfterReplay = await (
    await fetch(`http://127.0.0.1:${PORT_B}/parties/main/${ROOM}`)
  ).json();
  const cabsAfterReplay = cabNames(stateAfterReplay).length;
  finding(
    "re-send of a pre-migration action id",
    `accepted and re-applied (cabs ${cabsBeforeReplay} -> ${cabsAfterReplay}); ` +
      `harmless here only because addCab writes to a payload-keyed slot. ` +
      `drawings/addOneChart does an unkeyed charts.push() and would duplicate`,
  );

  // ---- phase 7: control — hydration is keyed, not wholesale
  log("\n▸ phase 7: control — a room the backend never saw");
  const controlClient = new RehearsalClient(PORT_B, UNTOUCHED_ROOM);
  await controlClient.connect();
  const controlCabs = cabNames(controlClient.roomstate.state);
  check(
    "an unknown room starts fresh rather than inheriting state",
    controlCabs.length === 1 && controlCabs[0] === "Primary Cab",
    `cabs=[${controlCabs.join(", ")}]`,
  );
  controlClient.close();

  // ---- phase 8: the failure mode a paused free-tier project would produce
  log("\n▸ phase 8: migrating while the shared backend is unavailable");
  await setBackendFailure({ reads: true });
  const brokenClient = new RehearsalClient(PORT_B, "unavailable-backend-room");
  await brokenClient.connect();
  const brokenCabs = cabNames(brokenClient.roomstate.state);
  const brokenSnapshot = await debugSnapshot(
    PORT_B,
    "unavailable-backend-room",
  );
  finding(
    "a failed hydrate serves an empty room rather than refusing",
    `cabs=[${brokenCabs.join(", ")}], hydration.source=${brokenSnapshot.hydration?.source}, ` +
      `error=${brokenSnapshot.hydration?.error ?? "none"}`,
  );
  brokenClient.close();

  clientB.close();
  await stopDeployment(deploymentB, PORT_B);

  // ---- phase 9: does an empty room then overwrite the real row?
  //
  // Phase 8 showed a failed hydrate serves an empty room. The question that
  // actually decides migration safety is what happens *next*: the first action
  // in that empty room triggers the usual upsert, and if that upsert lands it
  // replaces a perfectly good snapshot with a blank one. Reads failing while
  // writes succeed is exactly the shape of a paused/degraded backend.
  log("\n▸ phase 9: can a failed hydrate clobber the stored room?");
  const rowBefore = (await backendDump()).find((r) => r.id === ROOM);
  const cabsStoredBefore = cabNames(rowBefore?.state);

  const deploymentC = await startDeployment(
    "deployment-C",
    PORT_C,
    resolve(workDir, "storage-c"),
  );
  // reads down, writes up: the room cannot hydrate but can still persist
  await setBackendFailure({ reads: true, writes: false });
  const clobberClient = new RehearsalClient(PORT_C, ROOM);
  await clobberClient.connect();
  const cabsOnConnect = cabNames(clobberClient.roomstate.state);
  await clobberClient.send(
    addCabAction("Cab From Blank Room", "cab-blank"),
    "clobber-probe-1",
  );
  await sleep(1500);
  await setBackendFailure({ reads: false, writes: false });

  const rowAfter = (await backendDump()).find((r) => r.id === ROOM);
  const cabsStoredAfter = cabNames(rowAfter?.state);
  const lost = cabsStoredBefore.filter((c) => !cabsStoredAfter.includes(c));
  check(
    "a room that failed to hydrate does not overwrite the stored snapshot",
    lost.length === 0,
    lost.length
      ? `DATA LOSS: stored cabs went [${cabsStoredBefore.join(", ")}] -> ` +
          `[${cabsStoredAfter.join(", ")}], losing [${lost.join(", ")}] ` +
          `(room served ${cabsOnConnect.length} cab(s) on connect)`
      : `stored cabs intact: [${cabsStoredAfter.join(", ")}]`,
  );
  clobberClient.close();
  await stopDeployment(deploymentC, PORT_C);

  // ---- report
  log("\n=== results ===");
  const checks = results.filter((r) => !r.finding);
  const failed = checks.filter((r) => !r.passed);
  log(`  ${checks.length - failed.length}/${checks.length} checks passed`);
  const findings = results.filter((r) => r.finding);
  if (findings.length) {
    log(`  ${findings.length} finding(s) recorded — see notes above`);
  }
  if (failed.length) {
    log("\n  failures:");
    for (const f of failed) log(`   - ${f.name}: ${f.detail}`);
  }
  return failed.length === 0 ? 0 : 1;
}

let exitCode = 1;
try {
  exitCode = await main();
} catch (e) {
  log(`\n\x1b[31mrehearsal aborted:\x1b[0m ${e.message}`);
  if (verbose && e.stack) log(e.stack);
} finally {
  for (const record of children) stopProcess(record);
  await sleep(500);
}
process.exit(exitCode);
