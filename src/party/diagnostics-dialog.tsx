import { Alert, Badge, Button, Group, Modal, Text, Title } from "@mantine/core";
import { IconClipboard, IconCopy, IconFileText } from "@tabler/icons-react";
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
    <Modal
      opened={props.isOpen}
      onClose={props.onClose}
      title={t("party.diagnostics.title")}
      size="min(46rem, 92vw)"
    >
      <Alert color="blue" icon={<IconClipboard />}>
        {t("party.diagnostics.sharePrompt")}{" "}
        <a href={DISCORD_INVITE_URL} target="_blank" rel="noreferrer">
          {t("party.diagnostics.openDiscord")}
        </a>
      </Alert>

      <Group gap="xs" mt="md">
        <Title order={4}>{t("party.diagnostics.pending")}</Title>
        <Badge color={pending.length ? "yellow" : "green"} circle>
          {pending.length}
        </Badge>
      </Group>
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
        <Text c="dimmed">{t("party.diagnostics.noPending")}</Text>
      )}

      <Title order={4} mt="md">
        {t("party.diagnostics.logHeading")}
      </Title>
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
              <Text span c="dimmed" inherit>
                {formatTime(e.t)}
              </Text>{" "}
              {e.event}
              {e.detail ? ` — ${e.detail}` : ""}
            </div>
          ))}
        </div>
      ) : (
        <Text c="dimmed">{t("party.diagnostics.empty")}</Text>
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

      <Group justify="flex-end" gap="xs" mt="md">
        <Button
          variant="default"
          color={copied === "full" ? "green" : undefined}
          leftSection={<IconFileText size={16} />}
          onClick={() => copyReport("full")}
          data-umami-event="party-diagnostics-copy-full"
        >
          {copied === "full"
            ? t("party.diagnostics.copied")
            : t("party.diagnostics.copyFull")}
        </Button>
        <Button
          color={copied === "trimmed" ? "green" : undefined}
          leftSection={<IconCopy size={16} />}
          onClick={() => copyReport("trimmed")}
          data-umami-event="party-diagnostics-copy"
        >
          {copied === "trimmed"
            ? t("party.diagnostics.copied")
            : t("party.diagnostics.copy")}
        </Button>
      </Group>
    </Modal>
  );
}
