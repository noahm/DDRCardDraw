import type { GameData } from "../models/SongData";

/**
 * Origin of the data.ddr.tools publish Worker. Injected at build time
 * (webpack DefinePlugin): production data.ddr.tools, local wrangler dev otherwise.
 * Overridable with a `DATA_API_BASE` env var at build.
 */
const DATA_API_BASE = process.env.DATA_API_BASE || "https://data.ddr.tools";

export interface PublishResponse {
  id: string;
  url: string;
}

/**
 * Untrusted provenance stored alongside the bundle for abuse review. Counts are
 * recomputed server-side; this is just the source edit-code summary.
 */
export interface BundleSource {
  requestedCodes: string[];
  notFound: string[];
  unknownSongs: string[];
}

/**
 * Publish a built GameData bundle to the data.ddr.tools Worker, which validates it,
 * stores it as an immutable, content-addressed bundle on the CDN, and returns its
 * URL. This is a cross-origin POST, so the Worker's CORS allowlist must include the
 * calling app's origin (prod app origins in `vars`; dev origins in `.dev.vars`).
 */
export async function publishBundle(
  data: GameData,
  source: BundleSource,
  turnstileToken?: string,
): Promise<PublishResponse> {
  const res = await fetch(`${DATA_API_BASE}/api/datasets`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ data, meta: { source }, turnstileToken }),
  });

  if (!res.ok) {
    let detail = "";
    try {
      const body = (await res.json()) as { error?: string; errors?: string[] };
      detail = [body.error, ...(body.errors ?? [])].filter(Boolean).join(" — ");
    } catch {
      /* non-JSON error body */
    }
    throw new Error(detail || `publish failed (HTTP ${res.status})`);
  }

  return (await res.json()) as PublishResponse;
}
