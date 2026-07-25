import {
  Button,
  Callout,
  Classes,
  Dialog,
  DialogBody,
  DialogFooter,
  Intent,
  Tag,
} from "@blueprintjs/core";
import { Clipboard, Document, Duplicate } from "@blueprintjs/icons";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { useIntl } from "../hooks/useIntl";
import {
  formatAge,
  formatDiagnosticsReport,
  formatFullDiagnosticsReport,
  formatTime,
  getDiagnostics,
  getPendingActions,
  subscribeDiagnostics,
} from "./diagnostics";
import { DISCORD_INVITE_URL } from "../external-links";

/** events that indicate something went wrong, highlighted in the list */
const PROBLEM_EVENTS = new Set([
  "disconnected",
  "action-rejected",
  "action-abandoned",
  "action-blocked",
  "heartbeat-lost",
  "resync",
]);

export function DiagnosticsDialog(props: {
  isOpen: boolean;
  onClose: () => void;
  roomName?: string;
}) {
  const { t } = useIntl();
  const entries = useSyncExternalStore(subscribeDiagnostics, getDiagnostics);
  const [copied, setCopied] = useState<"trimmed" | "full" | null>(null);
  const fallbackRef = useRef<HTMLTextAreaElement>(null);
  // pending ages tick on their own, so re-render on a timer while open
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!props.isOpen) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [props.isOpen]);

  useEffect(() => {
    if (!copied) return;
    const id = setTimeout(() => setCopied(null), 2500);
    return () => clearTimeout(id);
  }, [copied]);

  const pending = getPendingActions();

  async function copyReport(kind: "trimmed" | "full") {
    const report =
      kind === "trimmed"
        ? formatDiagnosticsReport(props.roomName)
        : formatFullDiagnosticsReport(props.roomName);
    try {
      await navigator.clipboard.writeText(report);
      setCopied(kind);
    } catch {
      // clipboard can be unavailable (insecure context, denied permission):
      // fall back to selecting the text so the user can copy it by hand. The
      // value is set imperatively because a state update wouldn't have landed
      // by the time we select.
      const area = fallbackRef.current;
      if (area) {
        area.value = report;
        area.select();
        setCopied(document.execCommand("copy") ? kind : null);
      }
    }
  }

  return (
    <Dialog
      isOpen={props.isOpen}
      onClose={props.onClose}
      title={t("party.diagnostics.title")}
      style={{ width: "min(46rem, 92vw)" }}
    >
      <DialogBody>
        <Callout intent={Intent.PRIMARY} icon={<Clipboard />}>
          {t("party.diagnostics.sharePrompt")}{" "}
          <a href={DISCORD_INVITE_URL} target="_blank" rel="noreferrer">
            {t("party.diagnostics.openDiscord")}
          </a>
        </Callout>

        <h4 className={Classes.HEADING} style={{ marginTop: "1rem" }}>
          {t("party.diagnostics.pending")}{" "}
          <Tag intent={pending.length ? Intent.WARNING : Intent.SUCCESS} round>
            {pending.length}
          </Tag>
        </h4>
        {pending.length ? (
          <ul style={{ margin: 0, paddingLeft: "1.25rem" }}>
            {pending.map((p, i) => (
              <li key={`${p.type}-${p.since}-${i}`}>
                <code>{p.type}</code> — {formatAge(p.since, now)},{" "}
                {t("party.diagnostics.attempts", { count: p.attempts })}
              </li>
            ))}
          </ul>
        ) : (
          <p className={Classes.TEXT_MUTED}>
            {t("party.diagnostics.noPending")}
          </p>
        )}

        <h4 className={Classes.HEADING} style={{ marginTop: "1rem" }}>
          {t("party.diagnostics.logHeading")}
        </h4>
        {entries.length ? (
          <div
            style={{
              maxHeight: "18rem",
              overflowY: "auto",
              fontFamily: "monospace",
              fontSize: "0.85em",
              lineHeight: 1.6,
            }}
          >
            {entries.map((e, i) => (
              <div
                key={`${e.t}-${i}`}
                style={{
                  color: PROBLEM_EVENTS.has(e.event) ? "#c87619" : undefined,
                }}
              >
                <span className={Classes.TEXT_MUTED}>{formatTime(e.t)}</span>{" "}
                {e.event}
                {e.detail ? ` — ${e.detail}` : ""}
              </div>
            ))}
          </div>
        ) : (
          <p className={Classes.TEXT_MUTED}>{t("party.diagnostics.empty")}</p>
        )}

        {/* offscreen copy target for browsers without the async clipboard */}
        <textarea
          ref={fallbackRef}
          aria-hidden
          tabIndex={-1}
          defaultValue=""
          style={{
            position: "absolute",
            left: "-9999px",
            width: "1px",
            height: "1px",
          }}
        />
      </DialogBody>
      <DialogFooter
        actions={
          <>
            <Button
              icon={<Document />}
              intent={copied === "full" ? Intent.SUCCESS : Intent.NONE}
              onClick={() => copyReport("full")}
              text={
                copied === "full"
                  ? t("party.diagnostics.copied")
                  : t("party.diagnostics.copyFull")
              }
              data-umami-event="party-diagnostics-copy-full"
            />
            <Button
              icon={<Duplicate />}
              intent={copied === "trimmed" ? Intent.SUCCESS : Intent.PRIMARY}
              onClick={() => copyReport("trimmed")}
              text={
                copied === "trimmed"
                  ? t("party.diagnostics.copied")
                  : t("party.diagnostics.copy")
              }
              data-umami-event="party-diagnostics-copy"
            />
          </>
        }
      />
    </Dialog>
  );
}
