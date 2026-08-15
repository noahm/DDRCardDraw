/**
 * A small in-memory log of what the party connection has been doing, kept so
 * an organizer hitting connection trouble at an event can read it themselves
 * and paste it to us without opening devtools.
 *
 * Like `connection-status.ts`, this lives outside redux on purpose: anything
 * in the store is broadcast to the room and persisted server-side, and a
 * per-client debug log is neither shared state nor something we want written
 * into every event's snapshot.
 */

export interface DiagnosticEntry {
  /** epoch ms */
  t: number;
  /** short label, e.g. "connected" / "action-rejected" */
  event: string;
  /** optional human-readable extra detail */
  detail?: string;
}

/** one locally-dispatched action still waiting for the server to confirm it */
export interface PendingActionInfo {
  type: string;
  attempts: number;
  /** epoch ms of the first send attempt */
  since: number;
}

/** plenty to cover an evening's worth of trouble without growing unbounded */
const MAX_ENTRIES = 200;

let entries: readonly DiagnosticEntry[] = [];
const listeners = new Set<() => void>();
let pendingProvider: (() => PendingActionInfo[]) | undefined;

function emit() {
  for (const listener of listeners) listener();
}

/** record one thing that happened on the party connection */
export function logDiagnostic(event: string, detail?: string) {
  // replace rather than mutate so useSyncExternalStore sees a new snapshot
  const next = entries.concat({ t: Date.now(), event, detail });
  entries = next.length > MAX_ENTRIES ? next.slice(-MAX_ENTRIES) : next;
  emit();
}

export function getDiagnostics(): readonly DiagnosticEntry[] {
  return entries;
}

export function subscribeDiagnostics(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/**
 * The sync manager owns the pending list, so it registers a getter here rather
 * than us duplicating that state.
 */
export function setPendingActionsProvider(
  provider: (() => PendingActionInfo[]) | undefined,
) {
  pendingProvider = provider;
}

export function getPendingActions(): PendingActionInfo[] {
  return pendingProvider?.() ?? [];
}

export function clearDiagnostics() {
  entries = [];
  emit();
}

function pad(n: number) {
  return String(n).padStart(2, "0");
}

/** local wall-clock time, which is what a user reading along will recognise */
export function formatTime(t: number) {
  const d = new Date(t);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

export function formatAge(since: number, now = Date.now()) {
  const seconds = Math.max(0, Math.round((now - since) / 1000));
  if (seconds < 60) return `${seconds}s`;
  return `${Math.floor(seconds / 60)}m${pad(seconds % 60)}s`;
}

/** local UTC offset as "+02" / "-05:30", for reading timestamps back later */
function utcOffset(d: Date) {
  // getTimezoneOffset is minutes *behind* UTC, so the sign is inverted
  const total = -d.getTimezoneOffset();
  const sign = total < 0 ? "-" : "+";
  const hours = pad(Math.floor(Math.abs(total) / 60));
  const minutes = Math.abs(total) % 60;
  return `${sign}${hours}${minutes ? `:${pad(minutes)}` : ""}`;
}

/**
 * A fenced block would end early if its own content contained a fence, so
 * neutralise any backticks coming from a reducer's error message.
 */
function fenced(lines: string[]) {
  return ["```", ...lines.map((l) => l.replaceAll("```", "'''")), "```"];
}

/**
 * Discord rejects messages over 2000 characters (it offers to upload the paste
 * as a file instead, which loses the formatting). The default report is
 * trimmed to fit under that, keeping the most recent events, since the tail of
 * a log is where the trouble is. `formatFullDiagnosticsReport` is the escape
 * hatch when every event is wanted.
 */
const DISCORD_MESSAGE_LIMIT = 2000;
/** a little headroom, so a report that just fits isn't right on the edge */
const MARKDOWN_BUDGET = DISCORD_MESSAGE_LIMIT - 100;

function reportBody(
  roomName: string | undefined,
  now: Date,
  pending: PendingActionInfo[],
  shown: readonly DiagnosticEntry[],
  total: number,
  md: boolean,
): string {
  const code = (s: string) => (md ? `\`${s}\`` : s);
  const label = (l: string, v: string) =>
    md ? `**${l}:** ${v}` : `${l}: ${v}`;
  const block = (body: string[]) =>
    md ? fenced(body) : body.map((l) => `  ${l}`);
  const none = (s: string) => (md ? `_${s}_` : `  ${s}`);

  const pendingBody = pending.map(
    (p) =>
      `${p.type} — waiting ${formatAge(p.since, now.getTime())}, ${p.attempts} attempt(s)`,
  );

  // pad the event column so details line up down the block
  const width = shown.reduce((w, e) => Math.max(w, e.event.length), 0);
  const logBody = shown.map(
    (e) =>
      `${formatTime(e.t)}  ${e.event.padEnd(width)}${e.detail ? `  ${e.detail}` : ""}`,
  );

  const omitted = total - shown.length;
  const logCount = omitted
    ? `most recent ${shown.length} of ${total} events`
    : `${total} event${total === 1 ? "" : "s"}`;

  return [
    md
      ? "**DDRCardDraw event connection diagnostics**"
      : "DDRCardDraw event connection diagnostics",
    label("Room", code(roomName ?? "(unknown)")),
    label(
      "Generated",
      `${now.toISOString()} (local ${formatTime(now.getTime())}, UTC${utcOffset(now)})`,
    ),
    label(
      "Browser",
      code(
        typeof navigator === "undefined" ? "(unknown)" : navigator.userAgent,
      ),
    ),
    "",
    label("Changes not yet saved to the server", String(pending.length)),
    ...(pending.length
      ? block(pendingBody)
      : [none("none — the server confirmed every change")]),
    "",
    md
      ? `**Connection log** (${logCount}, oldest first)`
      : `Connection log (${logCount}, oldest first)`,
    ...(shown.length ? block(logBody) : [none("nothing recorded")]),
    ...(omitted
      ? [
          none(
            `${omitted} earlier event${omitted === 1 ? "" : "s"} trimmed to fit — ask for the full log if needed`,
          ),
        ]
      : []),
  ].join("\n");
}

/**
 * The report the main copy button puts on the clipboard: Discord-flavoured
 * markdown, trimmed to fit in one message. Bold labels make it skimmable, and
 * the two lists sit in fenced blocks so they keep their column alignment and
 * so action types and user-agent strings can't be eaten by markdown's own
 * syntax.
 */
export function formatDiagnosticsReport(roomName?: string): string {
  const now = new Date();
  const pending = getPendingActions();
  const total = entries.length;
  // include as many of the most recent events as fit; if even one event puts
  // us over (a huge pending list, say), keep it rather than emitting no log
  for (let take = total; take > 1; take--) {
    const text = reportBody(
      roomName,
      now,
      pending,
      entries.slice(total - take),
      total,
      true,
    );
    if (text.length <= MARKDOWN_BUDGET) return text;
  }
  return reportBody(roomName, now, pending, entries.slice(-1), total, true);
}

/**
 * Every recorded event, as plain text. For when the trimmed report isn't
 * enough and a maintainer asks for the lot — it is expected to arrive as a
 * file attachment, where markdown decoration would just be noise.
 */
export function formatFullDiagnosticsReport(roomName?: string): string {
  return reportBody(
    roomName,
    new Date(),
    getPendingActions(),
    entries,
    entries.length,
    false,
  );
}
