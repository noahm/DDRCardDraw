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

- **M1 — SMX testbed. ✅ Shipped 2026-08-10.** In-app SMX-edit authoring in the main app (paste codes →
  build → publish → draw), backed by a _headless_ anonymous publish API + CDN on `data.ddr.tools` that
  returns an immutable bundle URL. **Bundled stock data is left completely untouched**, and **end users
  never visit `data.ddr.tools`** (an early standalone authoring SPA prototype was backed out — see
  Service components below).
  `rgt-data` merged to `main` and deployed; the app change merged to `partykit` (`next.ddr.tools`'s
  production branch). See Verification below for what's been confirmed live.
- **M2 — ITG pack authoring. In progress.** In-browser pack parse, image resize, and jacket upload
  to the CDN, reached from a generalized "create custom data" chooser (SMX edits vs. pack import)
  plus the drag-and-drop folder entry point ported from `main`. Also lands the shared
  jackets-on-CDN dependency M3 needs: absolute jacket URLs + the `getJacketUrl` passthrough.
  See _ITG pack authoring_ below for the implemented design.
- **M3 — stock migration (not started).** Move schema/import scripts/catalogs into the data
  project, publish stock + jackets to the CDN behind a manifest, make the main app
  manifest-driven. Now strictly easier than it was: M2 establishes the jacket pool, its
  content-addressing, and the absolute-URL passthrough that M3 reuses.

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
  deleted), and `jackets/` is a shared pool referenced from *both*, so it needs its own
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
    R2 object's `Content-Type` is sniffed from magic bytes on upload, set on `PUT`, and served
    through as-is); `getJacketUrl` gains an absolute-URL passthrough. **Done in M2.**
    The base URL is injected at build (`CDN_BASE`) exactly like `DATA_API_BASE`, so a dev build
    publishes bundles whose art points back at the local wrangler server.
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
  a hash check immediately, since the reference *is* the file's own checksum).
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
   below). An early Vite + React + Mantine authoring SPA prototype on `data.ddr.tools` was **backed
   out** before shipping — `rgt-data` as merged is headless-only (Worker + static schema asset, no
   `src/app/`); revisit a standalone browse/authoring surface only if `data.ddr.tools` should grow
   one later. This keeps M1 to a single place users interact with.
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

**Added in M2:** `POST /api/datasets` also accepts `multipart/form-data` (`data` + one `jackets`
part per image), storing art in `jackets/{sha256hex}`. **Added later:** a privileged `POST /api/managed`
path + `index.json` manifest, and a stock import pipeline that runs `scripts/import-*.mts` to
publish catalog bundles + jackets (M3).

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

### M1 — in-app authoring, ships as one app change. ✅ Done (merged to `partykit` 2026-08-10)

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
  from two entry points sharing one global atom, both localized (`i18n.json`'s `createCustomData` key,
  en + ja) with matching SMX-specific copy — the hamburger menu and the game-data picker's custom-data
  folder. Published sets list under an always-present **"Custom Data"** folder in the
  picker (`src/hooks/useDataSets.ts`); selecting one sets `config.gameKey` to the URL — which syncs to
  peers, who resolve the same immutable bundle. Pinning is automatic (the URL _is_ the immutable
  bundle); only the short ref touches Redux/PartyKit/Supabase.
- **Card rendering restored.** The `smx` card variant (edit `author` line + edit code) is ported so
  drawn edit charts render correctly; `extras` carries the edit metadata. The QR-bookmark card action
  from `smx-edits` is dropped for now (partykit has no per-variant card-actions slot) — a later add.
- No `getJacketUrl` change (SMX edit bundles use relative jacket paths that already resolve).

### M2 — ITG pack authoring (in progress)

Same shape as M1 — build the bundle in-browser, publish, draw — plus the art, which is the part
M1 never had to solve.

- **One dialog, two importers.** `src/smx-edit-import.tsx` became `src/custom-data-import.tsx`: a
  chooser (StepManiaX edits / StepMania pack) hosting the unchanged SMX form and a new pack form.
  Both existing entry points already share the `createCustomData` i18n key, so they just open the
  chooser now. **Dropping a folder skips the chooser** — that's unambiguous — so `drop-handler.tsx`
  shrank to a listener that parks the item in a `pendingPackDrop` atom and opens the dialog. (It
  was dead code before this: present in the tree but mounted nowhere, and it wrote packs straight
  into `customDataCache` with session-local `blob:` urls, so nothing survived a reload or reached
  a peer.)
- **The folder picker needs a shim** (`src/utils/picked-folder.ts`). `parsePack` reads
  `input.webkitEntries`, which browsers only populate for files *dropped* onto an input — never
  from the picker dialog. The picker gives a flat `FileList` whose entries carry
  `webkitRelativePath`, so we rebuild the tree from those paths and expose it through the File
  System Access shape (`kind`/`values()`/`getFile()`) the parser already accepts. Using
  `showDirectoryPicker()` would hand back a real handle and avoid this, but it's Chromium-only;
  `webkitdirectory` works everywhere.
- **Jackets: resize in the browser, upload through the Worker as multipart parts.**
  `jacket-resize.ts` matches `scripts/utils.mts` exactly (128px wide, JPEG q80) so pack art lands
  at the same weight as bundled stock art — measured on a real 7-song pack: **8.6 MB of source art
  → 36 KB**. Each resized image is hashed client-side to build its CDN url, then posted as its own
  part of one `multipart/form-data` request.
  - **No archive format, and no dependency for one.** An earlier pass zipped the images first;
    that was redundant. The web platform has no built-in ZIP (`CompressionStream` is gzip/deflate
    *streams*, not the archive container — you'd hand-write local headers, a central directory,
    and CRC-32, which is what `fflate` was pulled in for), and a multipart request *is* already a
    container for many named files, with `FormData` and `request.formData()` built into both ends.
    Since the payload is finished JPEGs that don't recompress, the zip was doing no compression
    either — it was packaging inside packaging. Dropping it removed a dependency from both repos,
    a parse step and its failure mode from the Worker, and a progress phase from the UI.
  - **Why not presigned direct-to-R2 PUTs, as this doc originally called for?** They'd need an R2
    API token stored as a Worker secret, `aws4fetch`, and a *write* CORS policy on the bucket —
    and the bucket policy can't express the Vercel-preview origin pattern the Worker's allowlist
    already handles. Uploading through the API keeps every write behind the single
    origin-checked, Turnstile-gated, rate-limited path that already exists, and adds no new infra
    at all. The thing the Worker genuinely can't do — *decoding* images — still doesn't happen
    there; it only hashes pre-resized bytes and writes them.
  - **The Worker recomputes every hash from the uploaded bytes** rather than trusting the part's
    filename, so a caller can't overwrite existing art with different content by claiming someone
    else's hash. It sniffs content types from magic bytes (PNG/JPEG/WebP only) and **refuses the
    whole publish if the bundle references a hash that isn't in R2** — a dangling reference would
    otherwise be baked into an immutable, permanently-pinned URL. Caps: 500 images per publish,
    200 KB each, 20 MB total.
  - **Writes are unconditional, not checked-first.** Dedup still happens — identical art from any
    pack lands on the same key — but skipping a `HEAD` per image halves the request's subrequest
    count, which is what keeps a 500-image publish (sized for event packs like ITL plus unlocks,
    ~400) clear of the 1,000 internal-subrequest floor Cloudflare applies even on the free plan.
    Re-writing an existing object is a no-op given content addressing, and what a `HEAD` would
    save is fractions of a cent. Scaling much past this wants the D1-backed bulk existence check
    designed for stock publishing above, rather than a bigger cap.
- **Progress reporting.** Unlike SMX, publishing a pack is slow enough that a button spinner isn't
  honest feedback, so the form reports `resizing` (determinate, per-image) → `uploading` →
  `loading`.

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

**Turnstile widget config (decided, M1):** dashboard widget type **Managed** (not Invisible — keeps
the interactive-challenge fallback for ambiguous sessions, e.g. VPN/privacy-browser users, which an
anonymous community-facing flow is more likely to hit than an admin tool; Invisible also carries a
mandatory privacy-policy addendum obligation per Cloudflare's ToS). Client `appearance: "interaction-
only"` + `size: "normal"` (`src/utils/turnstile.tsx`) so the widget stays 0×0 for the common case and
only grows in (capped at Cloudflare's documented 300×65 "normal" box) for the subset actually
challenged — both are documented Turnstile options, see [client-side rendering
docs](https://developers.cloudflare.com/turnstile/get-started/client-side-rendering/widget-configurations/).

## Open questions / risks

- **(M2+) Schema/version coupling — low priority.** The `GameData` schema has been stable for years
  with no breaking changes anticipated, so this is not an M1 concern: the SMX builder and the app
  simply share the current schema/types (vendored or via `@ddr-tools/data-format`). Revisit only if a
  breaking change ever becomes necessary — at which point stamp a `schemaVersion` in each bundle so
  the app can tolerate older bundles pinned by long-lived rooms.
- **(M2 — ITG) Image weight & Worker limits. Resolved — see _ITG pack authoring_ below.** ITG packs
  carry real art (jackets, banners, full-res backgrounds) — a publish can be tens-to-hundreds of MB
  across hundreds of files, while the card UI needs only ~64–128px jackets. Two problems: (a)
  downscale to small jackets (as `scripts/utils.mts` jimp resize already does) or clients pull
  megabytes per postage-stamp image; (b) **do not route image _processing_ through the Worker** —
  Workers are ~128 MB memory, CPU-bounded, and can't run native `sharp`/libvips (only slow pure-JS
  jimp), so a pack's worth of decode+resize blows those limits. Resizing therefore happens in the
  browser. Extra thumbnail sizes, if ever wanted, go async (Cloudflare Queues) or via Cloudflare
  Images.
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

**M1 — done, confirmed live 2026-08-10 – 2026-08-12:**

- **Service unit:** ✅ publish a known SMX set (codes incl. a bogus one) via `wrangler dev` against
  local R2/D1; `data.json` validates against `songs.schema.json`, `meta.json` counts are right, and a
  second publish yields a new id (immutability).
- **CDN:** ✅ `curl cdn.data.ddr.tools/custom/{id}/data.json` → 200, long `Cache-Control`, CORS present
  (confirmed against a real published bundle, not just a synthetic check).
- **In-app authoring:** ✅ with bundled stock data still in place, _Import StepManiaX edits…_ (hamburger
  menu and the picker's matching entry) — paste codes (incl. a bogus one), publish, draw from the
  result; cross-origin `POST` succeeds (CORS allows the app origin, incl. local dev), stock games still
  load normally.
- **Sync + pinning:** ✅ confirmed locally (two-browser PartyKit room test, pre-merge) — every peer
  resolves the same immutable bundle; only the URL (not the catalog) crosses the wire.
- **Regression:** ✅ the SMX edit set shows the `edit` difficulty selected by default with author lines
  on cards; SMX jackets render via the existing `/jackets/smx/...` paths.
- **Abuse guardrails:** ✅ 405/preflight/origin-reject/Turnstile-403/CDN-404 smoke, plus a full positive
  publish flow, verified against the deployed prod Worker from a Vercel preview build before merge.
- **Shipped:** `rgt-data` PR [#2](https://github.com/RhythmGameTools/rgt-data/pull/2) merged to `main`
  2026-08-10 and deployed (`yarn deploy`, manual — no CI/CD yet, see Stock publish pipeline for the
  planned M3 automation); `next.ddr.tools` PR [#620](https://github.com/noahm/DDRCardDraw/pull/620)
  merged to `partykit` 2026-08-10 (that branch is what's live at `next.ddr.tools`, so this ships with
  its normal deploy — not independently re-verified in this session beyond confirming the site responds).

**M2 — automated coverage passing, browser pass still owed:**

- ✅ **Worker multipart path**, against `wrangler dev` with real R2/D1: publish with jackets → 201;
  art readable at `/jackets/{hash}` as `image/jpeg` with immutable caching; bundle round-trips with
  its CDN urls intact; republishing the same art converges on the same keys; referencing an
  un-uploaded jacket → 422; a non-image upload → 415; **the JSON/SMX path still 201s
  unchanged**. Plus a part-count stress test at the cap: 500 images publish, 501 → 413.
- ✅ **Folder-picker shim** against a real 7-song pack (`simfile-parser/packs/Dance! @ Anime Destiny
  2022`) driving the actual `parsePack`: pack name, song count, charts, artists, BPMs, and image
  `File`s all resolve.
- ✅ **Full pipeline** on that same pack — picker → parse → resize → publish → read back:
  8.6 MB art → 36 KB uploaded, every cap has orders of magnitude of headroom (biggest jacket 6.5 KB vs.
  the 200 KB cap; bundle 2.5 KB vs. 2 MB), all 7 jacket urls serve images, `meta.json` records the
  pack provenance.
- ✅ `yarn validate` (both repos) and a full production webpack build.
- ⬜ **Still to verify in a browser** (can't be exercised outside one): `createImageBitmap` +
  `canvas.toBlob` output on real pack art, the folder-picker dialog itself, drag-and-drop opening
  the dialog, the progress readout, cards rendering CDN jackets, and a two-peer PartyKit room
  seeing the same pack.

**M3 (not started):** stock import publishes a bundle + repoints `index.json` and the app picks it
up with no deploy; CDN-blocked resilience via service worker / bootstrap fallback.
