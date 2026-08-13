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
 * recomputed server-side; this is just a summary of what the set was built from.
 */
export type BundleSource =
  | {
      kind: "smx";
      requestedCodes: string[];
      notFound: string[];
      unknownSongs: string[];
    }
  | {
      kind: "itg";
      packName: string;
      songCount: number;
      tiered: boolean;
      jacketCount: number;
    };

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
  return post(
    JSON.stringify({ data, meta: { source }, turnstileToken }),
    "application/json",
  );
}

/**
 * Publish a bundle together with the jackets it references (ITG packs, whose art
 * doesn't exist anywhere yet). The Worker stores them in the content-addressed
 * pool and refuses the whole publish if the bundle points at an image that
 * didn't make it, so this can never half-succeed.
 *
 * Images go up as plain form parts — a multipart request is already a container
 * for many files, and they're finished JPEGs, so bundling them into an archive
 * would only add a dependency and a format to unpack for no gain. They must
 * already be resized client-side; see `jacket-resize.ts`.
 *
 * @param jackets resized images, keyed by the hash they're addressed at
 */
export async function publishBundleWithJackets(
  data: GameData,
  jackets: Map<string, Blob>,
  source: BundleSource,
  turnstileToken?: string,
): Promise<PublishResponse> {
  const form = new FormData();
  form.set("data", JSON.stringify(data));
  form.set("source", JSON.stringify(source));
  for (const [hash, blob] of jackets) {
    // The hash is only a label; the Worker recomputes it from the bytes.
    form.append("jackets", blob, hash);
  }
  if (turnstileToken) {
    form.set("turnstileToken", turnstileToken);
  }
  // No explicit content-type: the browser has to set the multipart boundary.
  return post(form);
}

async function post(
  body: BodyInit,
  contentType?: string,
): Promise<PublishResponse> {
  const res = await fetch(`${DATA_API_BASE}/api/datasets`, {
    method: "POST",
    headers: contentType ? { "content-type": contentType } : undefined,
    body,
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
