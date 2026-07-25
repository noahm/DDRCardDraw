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
 * The blob the copy button puts on the clipboard. Front-loads the context we'd
 * otherwise have to ask for (which room, when, which browser).
 *
 * Formatted as Discord-flavoured markdown, since the prompt next to the button
 * asks people to paste it there: bold labels to make it skimmable, and fenced
 * blocks for the two lists so they keep their column alignment and so action
 * types and user-agent strings can't be eaten by markdown's own syntax.
 */
export function formatDiagnosticsReport(roomName?: string): string {
  const now = new Date();
  const pending = getPendingActions();
  // pad the event column so details line up down the block
  const eventWidth = entries.reduce((w, e) => Math.max(w, e.event.length), 0);

  return [
    "**DDRCardDraw event connection diagnostics**",
    `**Room:** \`${roomName ?? "(unknown)"}\``,
    `**Generated:** ${now.toISOString()} (local ${formatTime(now.getTime())}, UTC${utcOffset(now)})`,
    `**Browser:** \`${
      typeof navigator === "undefined" ? "(unknown)" : navigator.userAgent
    }\``,
    "",
    `**Changes not yet saved to the server:** ${pending.length}`,
    ...(pending.length
      ? fenced(
          pending.map(
            (p) =>
              `${p.type} — waiting ${formatAge(p.since, now.getTime())}, ${p.attempts} attempt(s)`,
          ),
        )
      : ["_none — the server confirmed every change_"]),
    "",
    `**Connection log** (${entries.length} event${entries.length === 1 ? "" : "s"}, oldest first)`,
    ...(entries.length
      ? fenced(
          entries.map(
            (e) =>
              `${formatTime(e.t)}  ${e.event.padEnd(eventWidth)}${e.detail ? `  ${e.detail}` : ""}`,
          ),
        )
      : ["_nothing recorded_"]),
  ].join("\n");
}
