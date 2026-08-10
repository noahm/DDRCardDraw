import { useEffect, useRef } from "react";

/**
 * Cloudflare Turnstile for the SMX publish flow. Renders only when a site key is
 * configured at build time (`process.env.TURNSTILE_SITE_KEY`, injected by webpack
 * DefinePlugin); otherwise it's a no-op and no token is required — mirroring the
 * data.ddr.tools Worker, which skips verification unless `TURNSTILE_SECRET` is set.
 * The two must be turned on together: a site key here without the Worker secret just
 * sends an ignored token; the Worker secret without a site key here would 403 every
 * publish (no token sent).
 *
 * No external dependency: loads Cloudflare's official api.js on demand and drives
 * `window.turnstile` directly (explicit-render mode).
 */

/** Public Turnstile site key; empty string disables the widget (and the token gate). */
export const TURNSTILE_SITE_KEY = process.env.TURNSTILE_SITE_KEY || "";

const SCRIPT_SRC =
  "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";

// Minimal shape of the global the script installs; avoids pulling in extra types.
interface TurnstileApi {
  render(
    el: HTMLElement,
    opts: {
      sitekey: string;
      appearance?: "always" | "execute" | "interaction-only";
      size?: "normal" | "flexible" | "compact";
      callback: (token: string) => void;
      "expired-callback"?: () => void;
      "error-callback"?: () => void;
      "timeout-callback"?: () => void;
    },
  ): string;
  remove(id: string): void;
}

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

let scriptPromise: Promise<void> | null = null;
/** Inject the Turnstile script once; subsequent callers reuse the same promise. */
function loadTurnstileScript(): Promise<void> {
  if (window.turnstile) return Promise.resolve();
  if (scriptPromise) return scriptPromise;
  scriptPromise = new Promise<void>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = SCRIPT_SRC;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => {
      scriptPromise = null; // allow a retry on next mount
      reject(new Error("Failed to load Turnstile"));
    };
    document.head.appendChild(script);
  });
  return scriptPromise;
}

/**
 * Renders the Turnstile challenge and reports tokens to the parent: a fresh token on
 * success, and `null` when it expires, errors, or times out — so callers can gate
 * submission on a present token. Tokens are single-use; remount (e.g. via a changing
 * `key`) to obtain a fresh one after a publish attempt. Renders nothing when no site
 * key is configured.
 */
export function TurnstileWidget({
  onToken,
}: {
  onToken: (token: string | null) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  // hold the latest callback so the render effect can stay mount-only
  const onTokenRef = useRef(onToken);
  onTokenRef.current = onToken;

  useEffect(() => {
    if (!TURNSTILE_SITE_KEY) return;
    const el = containerRef.current;
    if (!el) return;
    let widgetId: string | undefined;
    let cancelled = false;

    loadTurnstileScript()
      .then(() => {
        if (cancelled || !window.turnstile) return;
        widgetId = window.turnstile.render(el, {
          sitekey: TURNSTILE_SITE_KEY,
          // Stay hidden unless Cloudflare actually needs an interactive challenge from
          // this session (requires the site key's dashboard widget mode to be Managed,
          // not Invisible, or there's no interactive check left to reveal).
          appearance: "interaction-only",
          // Fixed footprint (Cloudflare's documented "normal" size: 300x65) so the
          // container below can cap its box exactly, instead of guessing.
          size: "normal",
          callback: (token) => onTokenRef.current(token),
          "expired-callback": () => onTokenRef.current(null),
          "error-callback": () => onTokenRef.current(null),
          "timeout-callback": () => onTokenRef.current(null),
        });
      })
      .catch(() => onTokenRef.current(null));

    return () => {
      cancelled = true;
      if (widgetId && window.turnstile) window.turnstile.remove(widgetId);
    };
  }, []);

  if (!TURNSTILE_SITE_KEY) return null;
  return <div ref={containerRef} />;
}
