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
- **M2 — ITG pack authoring. ✅ Shipped 2026-10-14.** In-browser pack parse, image resize, and jacket upload
  to the CDN, reached from a generalized "create custom data" chooser (SMX edits vs. pack import)
  plus the drag-and-drop folder entry point ported from `main`. Also lands the shared
  jackets-on-CDN dependency M3 needs: absolute jacket URLs + the `getJacketUrl` passthrough.
  `rgt-data` PR #3 merged to `main` and deployed; the app change (PR #630) merged to `partykit`.
  See _ITG pack authoring_ below for the implemented design.
- **M3 — stock migration (in progress — step 1 of 7 done).** Move schema/import scripts/catalogs
  into the data project, publish stock + jackets to the CDN behind a manifest, make the main app
  manifest-driven. Now strictly easier than it was: M2 establishes the jacket pool, its
  content-addressing, and the absolute-URL passthrough that M3 reuses. See _M3 rollout_ below for
  the step order.
- **Self-hosted mode (after M3, not started).** Run the whole stack locally — app, PartyKit server,
  and data — for events without internet. Replaces the service worker + `yarn build:zip` offline
  story, which M3 removes. Its own milestone; design open (see Open questions / risks).

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
  bucket, four prefixes:
  ```
  custom/{id}/data.json      # id = nanoid(10); user-published sets (M1: SMX edits)
  custom/{id}/meta.json
  stock/{game}/{hash}/...    # managed catalogs (M3); hash = content hash of the catalog
  jackets/{sha256hex}        # flat content-addressed image pool, shared by custom + stock (M2/M3)
  legacy/jackets/smx/...     # frozen copy of the app's bundled SMX jackets, for M1 bundles (M3)
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
    R2 object's `Content-Type` is sniffed from magic bytes on upload, set on `PUT`, and served
    through as-is); `getJacketUrl` gains an absolute-URL passthrough. **Done in M2.**
    The base URL is injected at build (`CDN_BASE`) exactly like `DATA_API_BASE`, so a dev build
    publishes bundles whose art points back at the local wrangler server.
  - **Content-addressing dedupes real overlap for free.** Stock catalog versions that ship the
    same art (e.g. DDR World vs. A20 Plus share most jackets) converge on one object automatically
    when the import script hashes each file and only uploads on a cache miss (`HEAD` before
    `PUT`) — no manual song-to-song jacket linking needed, each song's entry just stores the
    resolved hash URL. For ITG (M2), uploads go through the Worker as multipart parts and are
    written unconditionally (see _ITG pack authoring_ below), so overlapping packs converge on the
    same objects but still re-send their bytes — storage dedupe, not bandwidth dedupe. This only dedupes
    byte-identical files; two independently resized/re-encoded copies of the same source art won't
    collide (perceptual hashing would, but that's out of scope).
- **Stock source data keeps relative jacket paths; publishing rewrites them.** Committed catalogs
  keep paths like `ddr_world/foo.jpg` against the local jacket source tree. The publish job hashes
  each referenced file, uploads what's missing, and writes absolute
  `https://cdn.data.ddr.tools/jackets/{sha256hex}` URLs into the _published_ `data.json` only. So
  the import scripts and `validate.mjs`'s `existsSync` jacket check work unchanged, contributor
  diffs stay readable, and no environment-specific CDN URL is ever committed (a dev publish
  rewrites to the local CDN base instead). A missing file still fails the publish. This supersedes
  an earlier design that committed absolute hash URLs and validated them by hash membership; it
  can be revisited if a reason appears.
  - Hash the same file that gets published — the committed jackets are already the resized,
    publish-ready versions.
  - **The local jacket source tree stays a complete, always-present mirror in the repo** (plain
    git, decided 2026-10-16 — committed jackets are already small; revisit `git-lfs` only if the
    repo becomes a problem).
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
  into this repo at the cutover, see _M3 rollout_) are run by hand as they are now — several are
  inherently interactive (SDVX needs a local arcade `music_db.xml` path passed as an arg, Ongeki
  needs a FlareSolverr instance for scraping, jacket collection is a manual copy step). CI has no
  business trying to re-run scraping/arcade-data imports headlessly. The maintainer runs the
  import, gets updated catalog JSON + jacket images as plain files, and commits/pushes them.
- **That push triggers the publish job** (GitHub Actions, `paths:`-filtered to the data-source
  directories so unrelated Worker code changes don't trigger it). Until the cutover the data source
  is DDRCardDraw `main`, so the job runs from (or checks out) that repo instead:
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

### M2 — ITG pack authoring. ✅ Done (merged to `partykit` 2026-10-14)

Same shape as M1 — build the bundle in-browser, publish, draw — plus the art, which is the part
M1 never had to solve.

- **One dialog, two importers.** `src/smx-edit-import.tsx` became `src/custom-data-import.tsx`: a
  chooser (StepManiaX edits / ITG pack) hosting the unchanged SMX form and a new pack form.
  Both existing entry points already share the `createCustomData` i18n key, so they just open the
  chooser now. **Dropping a pack (folder or `.zip`) skips the chooser** — that's unambiguous — so
  `drop-handler.tsx` shrank to a listener that parks the item in a `pendingPackDrop` atom and opens
  the dialog. (Before this it wrote packs straight into `customDataCache` with session-local
  `blob:` urls, so nothing survived a reload or reached a peer.)
- **Zips come from `simfile-parser` 1.0** (merged to `main` in #632): `parsePack` accepts a
  dropped/picked `.zip` directly and reads it lazily, and cover images became lazy `ImageRef`s
  (`await image.file()`). The pack form has a second "Choose .zip…" picker that hands the `File`
  straight to the parser; `resolveJackets(pack, urlFor, onProgress)` in `itg-import.ts` reads each
  song's cover once and maps it through the resize-hash-upload step.
- **The folder picker needs a shim** (`src/utils/picked-folder.ts`). `parsePack` reads
  `input.webkitEntries`, which browsers only populate for files _dropped_ onto an input — never
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
    _streams_, not the archive container — you'd hand-write local headers, a central directory,
    and CRC-32, which is what `fflate` was pulled in for), and a multipart request _is_ already a
    container for many named files, with `FormData` and `request.formData()` built into both ends.
    Since the payload is finished JPEGs that don't recompress, the zip was doing no compression
    either — it was packaging inside packaging. Dropping it removed a dependency from both repos,
    a parse step and its failure mode from the Worker, and a progress phase from the UI.
  - **Why not presigned direct-to-R2 PUTs, as this doc originally called for?** They'd need an R2
    API token stored as a Worker secret, `aws4fetch`, and a _write_ CORS policy on the bucket —
    and the bucket policy can't express the Vercel-preview origin pattern the Worker's allowlist
    already handles. Uploading through the API keeps every write behind the single
    origin-checked, Turnstile-gated, rate-limited path that already exists, and adds no new infra
    at all. The thing the Worker genuinely can't do — _decoding_ images — still doesn't happen
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
  `src/songs/*.json`. No baked-in bootstrap bundle — offline use moves to self-hosted mode (below).
- **`gameKey` accepts a name or a URL; unpinned is the default.** A stock name (`"a20plus"`) resolves
  through the manifest to the game's _current_ bundle — today's behavior, and what every room already
  persisted in Supabase `event_state` carries, so existing rooms keep working unchanged. A URL is an
  explicit pin to one immutable bundle (how custom sets already work). Selecting a stock game keeps
  storing its name. A UI to pin a room to an older stock version can come later if it's ever needed.
- **M1 SMX bundles' relative jacket paths go to an SMX-only legacy prefix on the CDN.** M1 SMX
  bundles are the only published data with relative jacket paths (`smx/...`, resolved through the
  app's bundled `/jackets/` today; ITG bundles are already absolute). Just the `smx/` subtree
  (563 files, ~5 MB) is copied to `legacy/jackets/smx/` (`rgt-data`'s
  `scripts/upload-legacy-jackets.mjs`), and `loadCustomGamedataByUrl` rewrites a custom bundle's
  relative `smx/` paths onto it at load time (`withLegacyJacketUrls`). The rewrite lives in the
  custom loader, not `getJacketUrl`, because stock SMX data also uses relative `smx/` paths and
  keeps gaining songs until stock moves to the CDN — routing those to the copy would break new
  songs' art. The copy is topped up (the script skips what's present) until the M3 cutover, then
  frozen. Rewriting the published bundles in place was considered and rejected: they're served
  `max-age=1y, immutable`, so browsers that already cached the old copy would keep the relative
  paths for up to a year and lose their art. After the cutover, new stock and SMX output uses
  absolute content-addressed `jackets/{sha256}` URLs; the SMX builder grafts onto the manifest's
  SMX catalog instead of the bundled one.
- **Backport the CDN reader to `main`.** Rather than freezing production's data once the import
  scripts move to `rgt-data`, the manifest loader + `getJacketUrl` change are ported (not merged —
  see Shared code) to `main` so `ddr.tools` reads stock data from the CDN until `partykit` replaces it.
  Scope is **stock only**: `main` gets no URL `gameKey` support. Custom-data URLs are an internal
  detail of `partykit` (set by the create flow, never shown to or pasted by users, and with no way to
  move them between configs), so there is nothing on `main` that could ever reference one.
- **Remove the service worker and the zip build** (`@lcdp/offline-plugin`, `zip-webpack-plugin`,
  `yarn build:zip`) on `partykit`. The hosted app becomes online-only; immutable bundles and jackets
  still get a year of browser HTTP caching.
- **Self-hosted mode replaces offline builds.** A way to run the whole stack locally — app, PartyKit
  server, and data (manifest, bundles, jackets) — for offline events. Design TBD (see Open questions).

### M3 rollout

Seven steps, in order. The principle: **the data's home moves last.** While either app bundles
`src/songs`, the data has to live in DDRCardDraw; once neither does, moving it is a pure repo
move with no user-facing effect, done on a day that suits the contributors.

**Publish source until the cutover: DDRCardDraw `main`.** That's where contributor data PRs
(mostly Nogic) already land. Data that has only landed on `partykit` gets backported to `main`
(step 2); after that, data changes go to `main` first and reach `partykit` through the regular
`main` → `partykit` merges, same as code.

1. **Legacy SMX jackets. ✅ Done 2026-10-15** (rgt-data #4, DDRCardDraw #669). The `smx/` jacket
   tree is on the CDN at `legacy/jackets/smx/`, and custom bundles' relative `smx/` paths are
   rewritten onto it at load. Keep topping it up (`upload-legacy-jackets.mjs --remote`) whenever
   the SMX catalog gains songs, until step 5.
2. **Backport `partykit`'s data to `main`. ✅ Done 2026-10-19** (DDRCardDraw #671). Catalogs and jackets that exist only on `partykit`
   (`syr5`, `syr6` + their 140 jackets, the `dashdance25` change), the schema's `chart.id`, and
   `validate.mjs`'s duplicate-chart-id check. `main` must handle `chart.id` (or at least ignore it
   harmlessly) before those sets reach its picker. After this step, `main`'s data is a superset of
   what `partykit` has, and stays the place data changes land.
3. **Schema revision.** In review 2026-10-20 as three PRs, merged in order: rgt-data #5 (hosts
   `v2.json`; the publish API validates bundles whose songs carry an `id` against v2, others
   against v1), DDRCardDraw #673 (`main`: repo schema = hosted v2, every catalog backfilled,
   importers write `id`), then the `partykit` follow-up (merges `main`, chart keys from `song.id`,
   loader upgrades id-less bundles). rgt-data #5 must be deployed before the `partykit` one ships,
   since its publishing then sends v2 bundles. Fold in the planned changes before anything is published, so the first
   CDN bundles already use the new shape (see _Schema revision_ below). Reconcile with the hosted
   `v1.json`, which drifted in both directions (hosted has `i18nDictPartial`; the repo has
   `chart.id` and the `additionalItems` rules). The schema stays hosted from `rgt-data`; both
   apps keep generating `SongData.ts` from their copy until the cutover.
4. **Publish pipeline in `rgt-data`.** `/api/managed/{check,objects,publish}` (bearer-token
   gated), the D1 `objects` table, `index.json`, and the GitHub Actions publish job, sourcing from
   a DDRCardDraw `main` checkout and rewriting relative jacket paths to hashed CDN URLs (see Data
   model). Nothing reads the manifest yet, so this ships dark.
5. **`partykit` goes manifest-driven.** Load `index.json`, resolve stock-name `gameKey`s through it
   (unpinned by default), drop bundled `src/songs` and jackets from the build, remove the service
   worker and zip build. The SMX edit builder grafts onto the manifest's SMX catalog, whose jackets
   are hashed CDN URLs — so no new bundles with relative paths get published, and
   `legacy/jackets/smx/` is **frozen** here (one last top-up first).
6. **Backport the stock reader to `main`.** Stock only (no URL `gameKey`s), ported not merged.
   After this, nothing ships from DDRCardDraw's `src/songs`; it's only the publish job's input.
7. **Cutover — move the data's home to `rgt-data`.**
   - Merge or close open data PRs on DDRCardDraw; announce a short freeze.
   - Import into `rgt-data` with **hybrid history** (decided 2026-10-16): `git filter-repo` keeps
     full history for `src/songs`, `scripts/` and the schema (~1,080 commits, ~6 MiB packed), and
     the jackets come over as **one snapshot commit** pointing back to DDRCardDraw for older
     history (~221 MiB, vs ~419 MiB with full jacket history — 80 MiB of that is pre-ImgBot
     originals, 115 MiB deleted/replaced art).
   - Repoint the publish job at `rgt-data`; confirm `index.json` comes out unchanged.
   - Delete the data and import scripts from DDRCardDraw (`main` and `partykit`); the apps get
     `SongData.ts` / the schema from `rgt-data` from then on.
   - Update contributor docs (README, scripts/README) and tell Nogic and the other contributors.

#### Schema revision (step 3)

Planned changes, all landed together:

- **`chart.id`** — already in the repo schema (optional explicit chart identity, overriding the
  derived `chartKey`). No catalog uses it yet.
- **`song.id` replaces `saIndex` and `saHash`** — one string, **required**, **unique within a
  file**, backfilled for every existing song. Published as a new **`v2.json`** schema (the hosted
  `v1.json` stays as is for bundles already pinned to it). Decided 2026-10-16:
  - **Where ids come from:** the source's own native id wherever one exists, otherwise a
    deterministic id derived from the song (same song → same id in every file, so cross-file chart
    matching like `dia_del_ritmo_26` ↔ `ddr_world` keeps working; random ids would break it).
    Today's fields map over as: DDR `saHash` (sanbai/3icecream id, which the share link needs);
    IIDX/jubeat/SDVX/Donkey Konga `saHash`; Pump/SMX/EZ2AC `saIndex` (SMX's is the
    573.no `song_id` the edit builder and score import match on). DDR's own `saIndex` (sanbai's
    numeric index) is unused and **dropped**. septa2-iidx's `saIndex` turned out to be a list
    position, so its songs take `iidx.json`'s textage ids instead (1,731 of 1,762; the rest derived).
    Derived ids are `deriveSongId` in `scripts/utils.mts`: the first 16 hex characters of a sha256
    of the NFKC-normalized name and artist, computed once and kept.
  - **No-id games:** ongeki uses the SEGA API's per-entry `id`; maimai and the ITG/tournament event
    sets (`itl24`, `itl25`, `syr5`, `syr6`, `storm*`, `shine*`, `bite9*`, `bhopball4`,
    `dashdance25`, `rip15singles`) get native ids where their import source has them, else
    derived ones. DRS's ids come from the official e-amusement music list (`import:drs`,
    DDRCardDraw #672), which also settled its duplicate entries; the 144 songs absent from that
    list get derived ids.
  - **No namespacing.** Ids are bare strings; numeric ids repeat across games (Pump and EZ2AC both
    start at `1`). Mixing data from different games in one set raises other problems anyway, so
    it's out of scope.
  - **Chart keys rooms already persisted keep matching.** `chart-id.ts` derives the song part of a
    chart key from `song.id` from now on, and `reuseKeysForChart` also returns the previous
    derivation (`saHash`, else `name|artist`) as an extra "already used" key, so charts drawn
    before the switch are still recognized. DDR/IIDX/SDVX/jubeat keys don't change at all, since
    their ids are the old `saHash`.
  - **Old published bundles keep working.** The app's loader upgrades a bundle with no `song.id`
    (`id` from `saHash`, else `saIndex`) before validating it against `v2`, so immutable M1 SMX
    bundles still validate and still match by 573.no id.
  - **`validate.mjs` rejects duplicate song ids within a file.**
- **One song per song within a file.** A file listing the same song more than once (one entry per
  chart) is an import-script artifact: those entries merge into one song with all their charts.
  A survey of every file (2026-10-16) found 90 groups of entries sharing a name + artist:
  - **Merge:** bite7 (19 songs listed 41 times; fix the event-set import so it emits one song with
    several charts) and maimai (2 utage songs split across 7 entries by level). Both merge with no
    conflicting song-level fields.
  - **Delete `tbd5`:** a stale copy of curated DDR data (its one duplicate entry was a symptom).
    Rooms persisted with `gameKey: "tbd5"` stop resolving, which is accepted.
  - **DRS:** 2 songs listed twice, one copy flagged `unlock`, translations differing slightly in
    one. Resolved together with sourcing DRS's real ids (above).
  - **Not duplicates — distinct songs sharing name + artist, which need distinct ids:** ongeki's
    65 LUNATIC re-releases ("bright MEMORY", each with its own jacket, date and chart; the SEGA
    `id` already tells them apart), and `ddr_x3`'s _IF YOU WERE HERE_ (the X3 vs 2nd MIX and the X2
    versions; neither has a `saHash`, so assign ids by hand).
- No other schema changes planned.

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
- **(M2+) Garbage/orphan bundles. Deferred** — watch R2 storage; build the sweep below only once
  cost justifies it. A plain R2 lifecycle rule expires by **age since creation, not
  last access** (no "delete if unrequested" primitive), and `immutable, max-age=1y` caching means
  active bundles rarely hit the R2 origin — so request-frequency would flag the _most-used_ bundles as
  stale. Age-based deletion is also a data-loss footgun: rooms **pin** a bundle id in `config.gameKey`
  (persisted in Supabase `event_state`), so expiring it can break a reopened event. **GC must be
  reference-aware:** never touch managed bundles; for custom bundles, compute the referenced set from
  `event_state` and delete only those **both** unreferenced **and** past a generous age (e.g. 90d).
  In practice this only matters once ITG image bundles exist — v1 JSON bundles are sub-MB, so orphans
  cost pennies. Do **not** ship an age-based lifecycle rule that could delete pinned data.
- **(M3 — stock migration) CDN as a single point of failure. Accepted.** With stock data no longer
  bundled, the hosted app can't load data if the CDN/manifest is unreachable. Decided: no service
  worker and no baked-in fallback — the hosted app is online-only, and anyone who needs to run without
  internet uses self-hosted mode.
- **(M3 — stock migration) Offline standalone build (`yarn build:zip`). Resolved: dropped,** along
  with the service worker, in favor of self-hosted mode.
- **(M3) Self-hosted mode design — open.** What serves data locally (e.g. `wrangler dev` with a seeded
  local R2, or a plain static mirror of the manifest/bundles/jackets), how it's seeded (a snapshot
  script against the CDN), how `CDN_BASE`/`DATA_API_BASE` get pointed at it (today they're baked in at
  build time), and whether it needs a Supabase stand-in for room persistence or can run on PartyKit
  storage alone.
- **(M3 — stock migration) Jacket migration volume.** Moving all existing stock jackets to R2 is a
  sizable one-time job (~13.8k files, ~252 MB); verify naming/paths and total size/egress before
  cutover. **Repo storage decided: plain git.** The committed jackets are already the resized
  publish-ready versions (no raw source art), so the local mirror moves into `rgt-data` as is;
  revisit `git-lfs` only if the repo actually becomes a problem.

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

**M2 — done, confirmed 2026-10-14:**

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
- ✅ **Browser pass** (manual testing): `createImageBitmap` + `canvas.toBlob` output on real pack
  art, the folder-picker dialog itself, drag-and-drop opening the dialog, the progress readout,
  cards rendering CDN jackets, and a two-peer PartyKit room seeing the same pack.
- **Shipped:** `rgt-data` PR [#3](https://github.com/RhythmGameTools/rgt-data/pull/3) merged to `main`
  2026-10-14 and deployed; `next.ddr.tools` PR [#630](https://github.com/noahm/DDRCardDraw/pull/630)
  merged to `partykit` 2026-10-14.

**M3 (not started):** stock import publishes a bundle + repoints `index.json` and the app picks it
up with no deploy; rooms persisted with a stock name load the current bundle; M1 SMX bundles still
render jackets via `legacy/jackets/`; `main` reads stock data from the CDN; self-hosted mode runs a
room with no internet.
