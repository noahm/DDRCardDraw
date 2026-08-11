# Plan: `data.ddr.tools` — a game-data platform (stock + custom) with creation & hosting

## Context

The `partykit` branch of ddr.tools is a large architectural fork that adds real-time multi-client
sync. Each event/room is a Redux store hosted by a **PartyKit** server: clients forward their local
actions over a websocket, the server replays them into its own store, rebroadcasts to peers, and
persists the full `AppState` to PartyKit storage + a Supabase `event_state` row
(`src/party/server.ts`). The synced state references a chosen data set **only by a string**,
`config.gameKey` (`src/state/config.slice.ts`).

Game data is resolved client-side, not stored in Redux:

- **Stock** sets load from bundled `src/songs/*.json` via `loadStockGamedataByName` into a jotai
  `stockDataCache` (`src/state/game-data.atoms.ts`).
- **Custom** sets currently land in an in-memory jotai `customDataCache` and show up in the picker
  (`src/hooks/useDataSets.ts`), but **`useGameData()` and every thunk resolve `gameKey` through
  `loadStockGamedataByName` only** (`src/state/hooks.tsx:31`, `src/state/thunks.ts`). So custom data
  is not actually drawable in a synced room, is never distributed to peers, and ITG jackets are
  ephemeral `blob:` URLs (`src/utils/jackets.ts`).

**The problem:** to make custom data (SMX edits now, ITG packs with images later) usable in synced
rooms, every client must be able to resolve a custom `gameKey` to the same data — without ballooning
the synced Redux/PartyKit/Supabase state with full catalogs and images.

**The end-state vision:** a standalone service, `data.ddr.tools`, that is the source of truth for
**all** game data — stock catalogs and custom sets alike — published to a CDN as immutable bundles,
so catalog updates ship without an app deploy and anyone can author a custom set. The main app stores
only a short reference in synced state and fetches bundles lazily.

**How we get there — incrementally, starting small.** We do **not** migrate stock data first. The
first shippable milestone puts SMX-edit creation **inside the main app** — paste codes, build the
bundle in-browser, publish it to the CDN, and draw from it — backed by a _headless_ anonymous publish
API on `data.ddr.tools`. End users never visit `data.ddr.tools` directly. That gets something real in
front of customers fast and serves as the testbed for everything after. Stock migration and ITG come
later.

## Milestones

- **M1 — SMX testbed (ship first).** In-app SMX-edit authoring in the main app (paste codes → build →
  publish → draw), backed by a _headless_ anonymous publish API + CDN on `data.ddr.tools` that returns
  an immutable bundle URL. **Bundled stock data is left completely untouched**, and **end users never
  visit `data.ddr.tools`** (a standalone authoring SPA there is coded but deferred — see below). This
  is the customer-facing testbed.
- **M2 / M3 — ITG and stock migration (order TBD).** Independent follow-ups; pick order later:
  - _ITG authoring:_ in-browser pack parse, image resize + upload to the CDN.
  - _Stock migration:_ move schema/import scripts/catalogs into the data project, publish stock +
    jackets to the CDN behind a manifest, make the main app manifest-driven.
  - Shared dependency both introduce: **jackets served from the CDN** (absolute URLs +
    `getJacketUrl` passthrough). Order tradeoff — stock-first establishes the manifest + jacket-on-CDN
    pattern that ITG reuses; ITG-first proves the image pipeline on a smaller surface.

## Locked decisions

- **Infra:** Cloudflare. CF Pages SPA + a Worker publish API; **R2** for bundles/images behind
  `cdn.data.ddr.tools`; **D1 or KV** for lightweight metadata. (New provider alongside existing
  Vercel/Supabase/PartyKit; chosen for cheap egress + strong CDN.)
- **`data.ddr.tools` already exists** — this is an extension of the current site, not a greenfield
  domain. The SMX authoring SPA + publish API are added to it.
- **Canonical schema is already hosted** at `https://data.ddr.tools/schema/v1.json` (the same
  "Game Data" draft-07 schema as the repo's `songs.schema.json`, currently slightly outdated). It
  becomes the **source of truth**: refresh it to match the current repo schema as M1 groundwork, have
  both the app and the tool validate against it, and set each bundle's `data.json` `$schema` to that
  URL.
- **Auth:** Anonymous only. Publishing returns an immutable, unguessable URL. No accounts, no
  "my sets" listing, no revoke UI.
- **Immutability:** every published bundle is write-once and content-addressed; editing = a new
  bundle. This is what lets a synced room safely pin a reference forever.
- **End-state data ownership (M3):** the data project eventually owns the schema, import scripts, and
  stock catalogs so stock updates are deploy-independent. Not part of M1.

## Architecture overview

```
  M1 — CUSTOM (anonymous, authored in-app)     [ M3 — STOCK (privileged), later ]
  main app: paste SMX codes (hamburger menu    import-*.mts in data project
    or picker's "Create custom data…")           build catalog + jackets
    build GameData in browser                    POST /api/managed → repoint index.json
    POST data.ddr.tools/api/datasets ─┐                      │
    (cross-origin; validate, limits)  │                      ▼
                                      ▼
        ┌──────────────── headless CF Worker writes R2 ───────────────┐
        │  custom/{id}/data.json  (M1+)                               │
        │  stock/{game}/{hash}/data.json  (M3)                        │
        │  jackets/{sha256} — flat, content-addressed (M2/M3)         │
        │     immutable, Cache-Control: max-age=1y                    │
        │  [ index.json manifest — M3 only ]                          │
        │  D1 row (kind, provenance, counts)                          │
        └────────────────────── cdn.data.ddr.tools ──────────────────┘
                         │
   returns { id, url }   ▼
   main app: load bundle into customDataCache, list under "Custom Data",
        select it ▶ config.gameKey = "https://cdn.data.ddr.tools/custom/{id}/data.json"
        syncs via PartyKit ▶ every peer fetches the same immutable bundle
```

## Data model & addressing

- **Bucket layout is split by top-level prefix, not mixed in one namespace.** One `rgt-bundles`
  bucket, three prefixes:
  ```
  custom/{id}/data.json      # id = nanoid(10); user-published sets (M1: SMX edits)
  custom/{id}/meta.json
  stock/{game}/{hash}/...    # managed catalogs (M3); hash = content hash of the catalog
  jackets/{sha256hex}        # flat content-addressed image pool, shared by custom + stock (M2/M3)
  ```
  The split matters for GC: `custom/` and `stock/` need different, independent lifecycle rules
  (custom bundles are reference-aware-GC'd per the note below; managed stock bundles are never
  deleted), and `jackets/` is a shared pool referenced from _both_, so it needs its own
  reference-count sweep across every bundle that could point at a given hash. A single mixed
  `bundles/` prefix would force every GC pass to consult D1's `kind` column before touching
  anything; the prefix split makes "never touch stock" and "only sweep custom" true by
  construction.
- **Content-addressed immutable bundles (all milestones).** A published set is written once
  (`id = nanoid(10)` for custom; a content hash for managed stock versions later). Bundles are
  never mutated; a new version = a new id. `Cache-Control: public, max-age=31536000, immutable`.
  - `data.json` — a full `GameData` document conforming to `songs.schema.json` / `models/SongData.ts`.
    For SMX this is the stock catalog + grafted edits, `meta.cardVariant: "smx"`, the `edit`
    difficulty registered and selected by default.
  - `meta.json` — provenance/index: title, base game, schema version, song/chart counts, `createdAt`,
    byte size, source summary (e.g. edit codes). For display/abuse review; not needed to draw.
- **Pinning is automatic for custom bundles.** Because a custom bundle URL already points at immutable
  content, attaching it sets `config.gameKey` to that URL and every peer / future reload resolves
  byte-identical data with no extra machinery. `gameKey` stays a plain string → no synced-schema
  change.
- **Jackets, by milestone:**
  - _M1 (SMX):_ edits reuse the main app's existing bundled SMX jackets. Keep **relative** jacket
    paths in `data.json`; the main app resolves them via `getJacketUrl` → `/jackets/smx/...` exactly
    as today. **No images are uploaded to the CDN, and no `getJacketUrl` change is needed.** (The
    tool's own preview can prefix paths with `https://ddr.tools` to render.)
  - _M2/M3 (ITG, stock):_ jackets move to the CDN as **absolute**
    `https://cdn.data.ddr.tools/jackets/{sha256hex}` URLs (content-addressed, no extension — the
    R2 object's `Content-Type` is set on `PUT` and served through as-is); `getJacketUrl` gains an
    absolute-URL passthrough.
  - **Content-addressing dedupes real overlap for free.** Stock catalog versions that ship the
    same art (e.g. DDR World vs. A20 Plus share most jackets) converge on one object automatically
    when the import script hashes each file and only uploads on a cache miss (`HEAD` before
    `PUT`) — no manual song-to-song jacket linking needed, each song's entry just stores the
    resolved hash URL. For ITG (M2), where uploads are presigned direct-to-R2 `PUT`s from the
    browser, the same `HEAD`-before-issuing-a-presigned-URL check means a pack that overlaps
    heavily with previously-uploaded packs skips re-uploading those files entirely, not just
    re-storing them — real bandwidth savings, not just storage savings. This only dedupes
    byte-identical files; two independently resized/re-encoded copies of the same source art won't
    collide (perceptual hashing would, but that's out of scope).
- **Local jacket validation survives the move to CDN URLs — and gets stronger.** Today
  `scripts/validate.mjs` checks `existsSync(jacketsDir + song.jacket)`: a relative path against a
  local directory, entirely offline, fast. Once `song.jacket`/`chart.jacket` become absolute
  `.../jackets/{sha256hex}` URLs that local directory relationship still holds — it just changes
  from a path-existence check to a content-hash-membership check, which is strictly stronger
  (a corrupted or swapped-in image at the right path silently passes `existsSync` today; it fails
  a hash check immediately, since the reference _is_ the file's own checksum).
  - Validator hashes every file once under the local jacket source tree into a `Map<hash, path>`,
    pulls the trailing path segment (the hash) back out of each `jacket` URL, and checks
    membership. Zero network calls, same speed as today.
  - This is the **same hashing pass** the M3 publish pipeline already does for its R2-diff step
    (see Stock publish pipeline) — one piece of shared logic, not duplicated tooling. It also
    produces the same "everything actually referenced" set the reference-aware GC sweep needs
    (see Open questions / risks) — worth sharing that code too when GC gets built.
  - Must hash the same pipeline stage that gets published (the final, resized `processed_img`
    output), not raw pre-resize sources — the CDN key is the hash of what's actually uploaded.
  - Cheap belt-and-suspenders addition: a JSON-Schema `pattern` on the jacket field
    (`^https://cdn\.data\.ddr\.tools/jackets/[0-9a-f]{64}$` for M2/M3 entries) catches a
    malformed or wrong-environment URL before it even reaches the hash lookup.
  - **This requires the local jacket source tree to stay a complete, always-present mirror in the
    repo** — not a staging area pruned after each publish to R2 — since local validation has
    nothing to check against otherwise. One-directional storage cost (repo only grows), but
    jackets are individually small and this keeps the fast offline dev loop; revisit with
    `git-lfs` if the repo ever balloons, not by giving up local validation.
- **Manifest (M3 only).** A mutable `index.json` maps managed game names → their current immutable
  `bundleUrl`, so stock catalogs update in place without an app deploy while the bundles they point at
  stay immutable. Custom bundles are **never** in the manifest — they're referenced by direct URL.

## Service components (`data.ddr.tools` — new repo)

**M1 needs only the headless anonymous tier (no user-facing site on `data.ddr.tools`):**

1. **Authoring UI lives in the main app, not here.** The SMX-edit _Create_ flow (paste codes → live
   validation against the 573.no API → Publish) is ported into the main app (see integration changes
   below). A standalone Vite + React + Mantine authoring SPA on `data.ddr.tools` is **coded but
   deferred** from the M1 user path; revisit if/when `data.ddr.tools` should grow its own
   browse/authoring surface. This keeps M1 to a single place users interact with.
2. **Worker API — `POST /api/datasets`** (anonymous): schema validation against a vendored
   `songs.schema.json`, size cap (≤~2 MB for SMX), per-IP rate limiting, optional **Turnstile**, id
   assignment, immutable R2 write, D1 insert, `{ id, url }` response. Called **cross-origin** from the
   app, so CORS must allow the app origins. Reads are served directly by R2 via `cdn.data.ddr.tools`
   (no Worker on the hot path).
3. **R2 bucket** behind `cdn.data.ddr.tools`: `custom/{id}/*` objects (later also `stock/` and
   `jackets/`, see Data model & addressing) get `max-age=1y, immutable` and permissive CORS
   (`ddr.tools` + `data.ddr.tools`, or `*`).
4. **Metadata (D1 preferred over KV)** table `datasets(id, kind, title, base_game, schema_version,
song_count, chart_count, size_bytes, created_at, source_json)` (`kind` ∈ {custom, managed}).

**Added later:** a privileged `POST /api/managed` path + `index.json` manifest (M3 stock migration),
and a stock import pipeline that runs `scripts/import-*.mts` to publish catalog bundles + jackets
(M3). ITG image upload infra — presigned direct-to-R2 PUTs (M2).

## Stock publish pipeline (M3)

Import and publish are two independently-triggered phases — only the second is automatable.

- **Import stays manual/local, unchanged.** Today's `scripts/import-*.mts` (moving from `ddr.tools`
  into this repo per Shared code between repos) are run by hand as they are now — several are
  inherently interactive (SDVX needs a local arcade `music_db.xml` path passed as an arg, Ongeki
  needs a FlareSolverr instance for scraping, jacket collection is a manual copy step). CI has no
  business trying to re-run scraping/arcade-data imports headlessly. The maintainer runs the
  import, gets updated catalog JSON + jacket images as plain files, and commits/pushes them.
- **That push triggers the publish job** (GitHub Actions, `paths:`-filtered to the data-source
  directories so unrelated Worker code changes don't trigger it):
  1. Walk the committed catalog + jacket source files, hash each candidate object (sha256; cheap —
     seconds even over hundreds of MB of images).
  2. Bulk-check which hashes **already exist** in R2 via `POST /api/managed/check` (`{ hashes[] }`
     → `{ missing[] }`), one or a few D1 `SELECT hash FROM objects WHERE hash IN (...)` queries
     (chunked to D1's bound-parameter limit) — not a `HEAD` per file. Mirrors the existing
     `datasets` D1 table pattern; add a parallel `objects(hash, kind, size_bytes, content_type,
first_seen_at)` table covering `stock`/`jackets`.
  3. Upload only the missing hashes via `POST /api/managed/objects` (one or small batches per
     call); Worker writes R2 + inserts the D1 row.
  4. Only once every object a new stock bundle references (its `data.json` + every jacket it
     points at) is confirmed present does CI call `POST /api/managed/publish` (`{ game,
bundleHash }`); the Worker re-verifies presence, then atomically repoints `index.json` — the
     one mutable pointer in the system, updated last so a partial-failure run never leaves the
     picker pointing at incomplete data.
- **Writes go through the Worker, not CI-direct-to-R2/D1.** Same reasoning as centralizing custom
  writes behind `/api/datasets`: `index.json` is the highest-blast-radius mutable state here, so
  exactly one server-validated code path should be able to touch it regardless of caller. All
  three `/api/managed/*` endpoints are bearer-token-gated (a CI-only secret — trusted-CI auth, not
  Turnstile's bot mitigation).
- **Idempotent and self-healing by construction.** Because every key is a content hash, there's no
  "last deployed sha" state to track or get out of sync — a retried/failed run just re-diffs the
  current tree against current D1 state and uploads whatever's still missing.
- **Rollback is just repointing.** Since bundles are immutable and `index.json` is the only mutable
  piece, reverting a bad stock update never needs a re-upload — point the game back at the
  previous bundle hash (worth having the Worker log prior values on each `publish` call so this is
  a lookup, not a guess).

## Shared code between repos

- **M1:** the canonical schema is the **already-hosted** `https://data.ddr.tools/schema/v1.json` —
  refresh it to match the repo's current `songs.schema.json`, then have both the app and the Worker
  validate against it (and generate `GameData`/`Chart` types from it). The SMX builder
  `src/utils/smx-edit-import.ts` (`parseEditCodes`, `fetchEditCharts`, `buildEditDataFile`; 573.no
  batching, song match by `saIndex` === `song_id`, URL-length-safe `MAX_BATCH=100`) plus the `smx` card
  variant and `extras` helper are **ported** from the `smx-edits` branch into the `partykit` app —
  _not_ git-merged: `partykit` has dropped the Zustand state model and rewritten the card-variant
  registry that branch builds on, so a merge would resurrect deleted code. (The Worker also vendors the
  builder for its own validation.) A thin `@ddr-tools/data-format` package can wrap the builder later,
  but the schema itself lives at the hosted URL.
- **M2/M3:** `src/utils/itg-import.ts` (`getDataFileFromPack`), `simfile-parser/browser`, and the
  jacket-resize helpers in `scripts/utils.mts`. In M3 the schema + import scripts **move** (not copy)
  to the data project, which becomes their owner — dissolving stock-drift, since the SMX-edit builder
  then grafts onto the data project's own canonical catalog.

## Main app (`ddr.tools`) integration changes

### M1 — in-app authoring, ships as one app change

- **Loader gains a URL branch.** In `src/state/game-data.atoms.ts`, generalize resolution so a
  `gameKey` that is an `http(s)` URL is fetched from the CDN, schema-checked, and cached in
  `customDataCache` (keyed by URL; safe to cache forever — immutable). A `gameKey` that is a known
  stock name keeps using the existing bundled `loadStockGamedataByName` path. **Bundled stock data,
  `availableGameData`, and jackets are all untouched.**
- **Resolve through it:** `useGameData()` (`src/state/hooks.tsx:31`) and the
  `loadStockGamedataByName(config.gameKey)` calls in `src/state/thunks.ts` route through the
  generalized loader. This is the single change that makes a URL target drawable in a synced room.
- **In-app authoring + publish UI.** A _Create SMX edit set_ dialog (paste codes → debounced live
  lookup against 573.no → Publish) builds the bundle in-browser, `POST`s it cross-origin to
  `data.ddr.tools/api/datasets` (base injected at build via `DATA_API_BASE`; prod `data.ddr.tools`, dev
  the local wrangler server), then loads the returned immutable URL into `customDataCache`. It opens
  from two entry points sharing one global atom: the hamburger menu and the game-data picker's **"Create
  custom data…"** item. Published sets list under an always-present **"Custom Data"** folder in the
  picker (`src/hooks/useDataSets.ts`); selecting one sets `config.gameKey` to the URL — which syncs to
  peers, who resolve the same immutable bundle. Pinning is automatic (the URL _is_ the immutable
  bundle); only the short ref touches Redux/PartyKit/Supabase.
- **Card rendering restored.** The `smx` card variant (edit `author` line + edit code) is ported so
  drawn edit charts render correctly; `extras` carries the edit metadata. The QR-bookmark card action
  from `smx-edits` is dropped for now (partykit has no per-variant card-actions slot) — a later add.
- No `getJacketUrl` change (SMX edit bundles use relative jacket paths that already resolve).

### M3 — manifest-driven (later, with stock migration)

- Replace `availableGameData` with a fetch of `index.json` (cached/revalidated via ETag); drop bundled
  `src/songs/*.json` (keep an optional baked-in bootstrap bundle as SPOF/offline fallback).
- `getJacketUrl` absolute-URL passthrough once jackets are on the CDN.
- Version-pin stock selections: store the manifest entry's immutable `bundleUrl` in `config.gameKey`
  (picker shows the friendly name), so a room stays on its version even if the catalog updates.

## Security & abuse (anonymous model)

Immutable + unguessable ids bound the blast radius and there's no PII. Mitigations on `POST`:
strict schema validation (reject anything not matching `GameData`), byte-size caps, per-IP rate
limiting, Turnstile, and a stored `source_json`/D1 row so any reported bundle can be traced and the
object removed from R2 out-of-band. CORS limited to the two app origins where practical.

## Open questions / risks

- **(M2+) Schema/version coupling — low priority.** The `GameData` schema has been stable for years
  with no breaking changes anticipated, so this is not an M1 concern: the SMX builder and the app
  simply share the current schema/types (vendored or via `@ddr-tools/data-format`). Revisit only if a
  breaking change ever becomes necessary — at which point stamp a `schemaVersion` in each bundle so
  the app can tolerate older bundles pinned by long-lived rooms.
- **(M2 — ITG) Image weight & Worker limits.** ITG packs carry real art (jackets, banners, full-res
  backgrounds) — a publish can be tens-to-hundreds of MB across hundreds of files, while the card UI
  needs only ~64–128px jackets. Two problems: (a) downscale to small jackets (as `scripts/utils.mts`
  jimp resize already does) or clients pull megabytes per postage-stamp image; (b) **do not route
  image processing through the Worker** — Workers are ~128 MB memory, CPU-bounded, can't run native
  `sharp`/libvips (only slow pure-JS jimp), and cap subrequests (~50 free / ~1000 paid), so a pack's
  worth of decode+resize+R2-writes blows those limits. **Fix:** resize in the browser
  (`createImageBitmap` + canvas; the pack is already parsed client-side via `simfile-parser/browser`)
  and upload finished jackets **direct to R2 via presigned PUT URLs**, leaving the Worker to handle
  only small JSON. Extra thumbnail sizes go async (Cloudflare Queues) or via Cloudflare Images.
- **(M2+) Garbage/orphan bundles.** A plain R2 lifecycle rule expires by **age since creation, not
  last access** (no "delete if unrequested" primitive), and `immutable, max-age=1y` caching means
  active bundles rarely hit the R2 origin — so request-frequency would flag the _most-used_ bundles as
  stale. Age-based deletion is also a data-loss footgun: rooms **pin** a bundle id in `config.gameKey`
  (persisted in Supabase `event_state`), so expiring it can break a reopened event. **GC must be
  reference-aware:** never touch managed bundles; for custom bundles, compute the referenced set from
  `event_state` and delete only those **both** unreferenced **and** past a generous age (e.g. 90d).
  In practice this only matters once ITG image bundles exist — v1 JSON bundles are sub-MB, so orphans
  cost pennies. Do **not** ship an age-based lifecycle rule that could delete pinned data.
- **(M3 — stock migration) CDN as a single point of failure.** With stock data no longer bundled, the
  app can't load anything if the CDN/manifest is unreachable. Mitigate with long-cache immutable
  bundles + the app's existing service worker (`@lcdp/offline-plugin`) caching fetched
  manifest/bundles, and optionally a baked-in bootstrap manifest + default bundle. Decide how much
  fallback to bake in.
- **(M3 — stock migration) Offline standalone build (`yarn build:zip`).** Currently ships a fully
  offline copy with bundled jackets. Once data + jackets live on the CDN it must either snapshot the
  CDN at build time or be dropped. Pick a path.
- **(M3 — stock migration) Jacket migration volume.** Moving all existing stock jackets to R2 is a
  sizable one-time job; verify naming/paths and total size/egress before cutover.

## Verification

**M1 (the shippable testbed):**

- **Service unit:** publish a known SMX set (codes incl. a bogus one) via `wrangler dev` against
  local R2/D1; assert `data.json` validates against `songs.schema.json`, `meta.json` counts are right,
  and a second publish yields a new id (immutability).
- **CDN:** `curl cdn.data.ddr.tools/custom/{id}/data.json` → 200, long `Cache-Control`, CORS present.
- **In-app authoring:** with bundled stock data still in place, open _Create custom data…_, paste codes
  (incl. a bogus one), publish, and draw from the result; confirm the cross-origin `POST` succeeds
  (CORS allows the app origin, incl. the local dev origin) and that stock games still load normally (the
  loader's stock branch is untouched).
- **Sync + pinning:** run the app + PartyKit locally; in browser A author + publish + draw; join the
  same room in browser B and confirm it resolves the same immutable bundle and draws identically.
  Inspect the PartyKit/Redux payload to confirm **only the URL** (not the catalog) crosses the wire.
- **Regression:** the SMX edit set shows the `edit` difficulty selected by default with author lines
  on cards; SMX jackets render via the existing `/jackets/smx/...` paths.

**Later milestones:** stock import publishes a bundle + repoints `index.json` and the app picks it up
with no deploy (M3); ITG pack parse → browser resize → presigned R2 upload → absolute CDN jacket URLs
render (M2); CDN-blocked resilience via service worker / bootstrap fallback (M3).
