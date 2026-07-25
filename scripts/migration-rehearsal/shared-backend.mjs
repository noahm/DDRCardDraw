#!/usr/bin/env node
/**
 * A stand-in for the shared Supabase backend, speaking just enough PostgREST
 * for `src/party/server.ts` to talk to it unmodified.
 *
 * Why fake it: the migration path in roadmap step 2.5 claims that a party
 * deployment with empty room storage rehydrates each room from Supabase on
 * first connect, and that this is what carries state across from the managed
 * PartyKit account to a self-hosted one. Testing that claim needs *two*
 * deployments pointed at *one* backend. Standing up a real Supabase project
 * would test Supabase; this tests our code's behaviour, which is the part in
 * question, and runs with no credentials.
 *
 * The supported surface is exactly what the server uses (verified against
 * @supabase/postgrest-js in node_modules):
 *
 *   GET  /rest/v1/event_state?select=state&id=eq.<room>
 *        -> 200 with a JSON *array* of 0 or 1 rows. `.maybeSingle()` on a GET
 *           asks for `application/json` and reduces the array client-side, so
 *           returning a bare object here would break it.
 *   POST /rest/v1/event_state   (Prefer: resolution=merge-duplicates)
 *        -> 201 with an empty body, which is what PostgREST returns when the
 *           caller has not asked for a representation.
 *
 * Plus two admin routes the rehearsal driver uses to inspect what landed:
 *
 *   GET /__admin/dump  -> every stored row
 *   GET /__admin/log   -> the request log, to prove who read/wrote what
 *
 * Failure injection (`--fail-writes`) exists so the rehearsal can also show
 * what a migration looks like when the carry-over backend is unavailable —
 * the case where a paused free-tier Supabase project would bite.
 */
import { createServer } from "node:http";

const args = process.argv.slice(2);
function flagValue(name, fallback) {
  const i = args.indexOf(name);
  return i === -1 ? fallback : args[i + 1];
}

const port = Number(flagValue("--port", "54321"));
const expectedKey = flagValue("--key", "rehearsal-key");
let failWrites = args.includes("--fail-writes");
let failReads = args.includes("--fail-reads");
const verbose = args.includes("--verbose");

/** id -> { id, state, updated_at } */
const rows = new Map();
/** every request, so the driver can assert on read/write traffic */
const requestLog = [];

function log(...parts) {
  if (verbose) console.log("[shared-backend]", ...parts);
}

function send(res, status, body, headers = {}) {
  const payload = body === undefined ? "" : JSON.stringify(body);
  res.writeHead(status, {
    "Content-Type": "application/json",
    "Content-Length": Buffer.byteLength(payload),
    ...headers,
  });
  res.end(payload);
}

/** PostgREST-shaped error body */
function sendError(res, status, message, code = "REHEARSAL") {
  send(res, status, { message, details: null, hint: null, code });
}

/** `id=eq.<value>` -> `<value>` */
function parseEqFilter(params, column) {
  const raw = params.get(column);
  if (!raw) return undefined;
  return raw.startsWith("eq.") ? raw.slice(3) : undefined;
}

/** honour `?select=state,updated_at` so the server's two queries differ */
function project(row, select) {
  if (!select || select === "*") return row;
  const columns = select.split(",").map((c) => c.trim());
  const out = {};
  for (const column of columns) {
    if (column in row) out[column] = row[column];
  }
  return out;
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${port}`);
  const entry = {
    at: new Date().toISOString(),
    method: req.method,
    path: url.pathname,
    query: url.search,
  };

  if (url.pathname === "/__admin/dump") {
    return send(res, 200, [...rows.values()]);
  }
  if (url.pathname === "/__admin/log") {
    return send(res, 200, requestLog);
  }
  if (url.pathname === "/__admin/fail") {
    // let the driver flip failure injection mid-run
    failWrites = url.searchParams.get("writes") === "true";
    failReads = url.searchParams.get("reads") === "true";
    return send(res, 200, { failWrites, failReads });
  }

  requestLog.push(entry);

  if (url.pathname !== "/rest/v1/event_state") {
    log("unhandled", req.method, url.pathname);
    return sendError(res, 404, `no route for ${url.pathname}`);
  }

  // supabase-js always sends these; a mismatch here would be a real 401, so
  // checking keeps the stand-in honest about the auth handshake
  const apikey = req.headers["apikey"];
  if (apikey !== expectedKey) {
    entry.result = "bad-key";
    return sendError(res, 401, "invalid api key", "PGRST301");
  }

  if (req.method === "GET") {
    if (failReads) {
      entry.result = "injected-read-failure";
      return sendError(res, 503, "injected read failure");
    }
    const id = parseEqFilter(url.searchParams, "id");
    const select = url.searchParams.get("select");
    const found = id === undefined ? [...rows.values()] : [rows.get(id)];
    const present = found.filter(Boolean).map((r) => project(r, select));
    entry.result = `read rows=${present.length}`;
    log("GET", id, "->", present.length, "row(s)");
    // an array, always: `.maybeSingle()` reduces it client-side
    return send(res, 200, present);
  }

  if (req.method === "POST") {
    if (failWrites) {
      entry.result = "injected-write-failure";
      return sendError(res, 503, "injected write failure");
    }
    const raw = await readBody(req);
    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch {
      entry.result = "bad-json";
      return sendError(res, 400, "invalid JSON body");
    }
    const incoming = Array.isArray(parsed) ? parsed : [parsed];
    const prefer = String(req.headers["prefer"] ?? "");
    if (!prefer.includes("resolution=merge-duplicates")) {
      // the server upserts; anything else means the contract drifted
      log("warning: POST without merge-duplicates Prefer header");
    }
    for (const row of incoming) {
      if (!row || typeof row.id !== "string") {
        entry.result = "missing-id";
        return sendError(res, 400, "row is missing a text id");
      }
      rows.set(row.id, {
        id: row.id,
        state: row.state ?? null,
        updated_at: row.updated_at ?? new Date().toISOString(),
      });
    }
    entry.result = `wrote rows=${incoming.length}`;
    log("POST", incoming.map((r) => r?.id).join(","));
    // PostgREST returns 201 and no body unless a representation was requested
    return send(res, 201, undefined);
  }

  entry.result = "method-not-allowed";
  return sendError(res, 405, `${req.method} not allowed`);
});

server.listen(port, "127.0.0.1", () => {
  console.log(`[shared-backend] listening on http://127.0.0.1:${port}`);
  console.log(`[shared-backend] table=event_state key=${expectedKey}`);
});

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => {
    server.close();
    process.exit(0);
  });
}
