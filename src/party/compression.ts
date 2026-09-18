/**
 * gzip helpers for values written to partykit room storage.
 *
 * Room storage rejects any value over 131072 bytes, measured on the
 * structured-clone payload: a typed array costs its `byteLength` plus 13 bytes
 * (verified against workerd), so compression converts almost 1:1 into headroom.
 * Event-mode state is thousands of repetitions of the same twenty key names,
 * which gzip takes to roughly a fifth of its size.
 *
 * `CompressionStream`/`DecompressionStream` are standard web APIs available in
 * the workers runtime with no compatibility flag, so this costs no dependency.
 */

/** compress a JSON-serializable value for storage */
export async function gzipJson(value: unknown): Promise<Uint8Array> {
  const stream = new Blob([JSON.stringify(value)])
    .stream()
    .pipeThrough(new CompressionStream("gzip"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

/**
 * Reverse of {@link gzipJson}. Throws on a truncated or non-gzip value — the
 * caller is expected to treat that as "storage holds nothing usable" rather
 * than trying to salvage it.
 */
export async function gunzipJson(bytes: Uint8Array): Promise<unknown> {
  const stream = new Blob([bytes as BlobPart])
    .stream()
    .pipeThrough(new DecompressionStream("gzip"));
  return JSON.parse(await new Response(stream).text()) as unknown;
}
