# Implementation Plan — Taipei Track Status Board

Nov 7, 2026 · @Katoku · Companion to PRD v0.1, TRD, App Flow Spec, Backend Schema and UI/UX Brief

## How to use this plan

Build v1 in nine phases, one phase per builder session. Each phase ends at an exit gate that must pass in CI before the next phase starts. The five specs stay the source of truth; this plan sets the order, the deliverables and the rulings where the specs disagree.

### Operating rules for the AI app builder

1. Load all five specs before Phase 1. The PRD file is UTF-16 LE with CRLF line endings; convert it to UTF-8 first (`iconv -f UTF-16LE -t UTF-8`), or some tools read it as noise.
2. Work one phase at a time, steps in order. Stop at each exit gate and report which checks pass.
3. When a spec is silent, choose the option that fails closed (`unknown`, never `open`), and log the choice in `docs/decisions.md`.
4. These rules apply in every phase:
   - No code path produces `open` except an in-date parsed fact, an active hours rule, or an unexpired override.
   - Every user-visible string lives in `src/copy.ts`, keyed by the spec IDs (E-xx, M-xx, S-xx).
   - Every date and time goes through one module, `src/shared/time.ts`, fixed to Asia/Taipei.
   - TypeScript strict, Zod at every external boundary, hand-written SQL, no ORM, fewer than 15 direct dependencies, each justified in the README.
   - Every job is idempotent, using the keys the Backend Schema defines.
   - Public pages set no cookies or local storage and make no third-party requests.
   - Never build accounts, signup, payments, booking, a map embed, a theme toggle or a language toggle.

### Which spec wins

| Topic | Authority | Fallback |
| --- | --- | --- |
| Tables, keys, KV/R2 layout, permissions, JWT verification | Backend Schema (Nov 6) | TRD |
| Routes, screens, behaviour, copy, error and empty states | App Flow Spec (Oct 24), except where the Schema resolves it | PRD |
| Tokens, type, components, layout, motion | UI/UX Brief (Nov 5) | App Flow Spec |
| Stack, infrastructure, polling contract, security headers | TRD (Oct 21) | PRD |
| Scope, priorities, tie-breaks | PRD v0.1 (Oct 16) | — |

### Conflicts and gaps already settled

| # | Where the specs disagree or are silent | Build this |
| --- | --- | --- |
| 1 | KV layout: TRD pointer key vs Schema direct objects | Schema: write `snapshot:v1:current:<name>` directly, plus timestamped copies for rollback |
| 2 | Ending an override: App Flow sets `expires_at = now` | Schema: set `ended_at` once; `expires_at` never changes |
| 3 | `source.muted_until` column | Schema: append-only `source_mute` table |
| 4 | One Worker with three entry points vs separate Workers | Schema: separate `web`, `admin`, `ingest`, `publish` Workers (`push` in v2), one repo, shared `src/` |
| 5 | TRD names Astro, but P1/P2 are rendered at runtime by `publish`, and the same VenueRow must render in admin and in the A2 live preview | Write UI components once in Hono JSX: string render in `publish` and `admin`, DOM render in the A2 preview. Escaping is on by default, no `innerHTML`. Astro is optional for static P3/P5 (decision D-1) |
| 6 | TRD CSP `script-src 'self'` blocks the P1 inline script | Add that script's `sha256-` hash to `script-src` at build time |
| 7 | `s-maxage=300` breaks the 60-second override promise | Purge `/`, `/history`, `/api/*` on every non-cron publish; measure KV propagation at the Phase 5 gate |
| 8 | Schema cites `migrations/core/0001_init.sql` and 111 constraint tests, but neither is in the folder | Regenerate both from the Schema's table reference in Phase 3 |
| 9 | Per-source `cron_minute` needs a cron finer than hourly | `ingest` cron runs every 5 min and fetches only sources whose minute bucket matches and whose `min_interval_s` has passed |
| 10 | Cron triggers run in UTC | 18:30 Taipei = `30 10 * * *`; every schedule in `wrangler` config carries a Taipei-time comment |
| 11 | PRD build step 2 (log sources without publishing) has no schema support | Add `mode: 'shadow' \| 'live'` per source in `src/sources.ts`. Shadow sources write `fetch_run`, R2 and a parse report, never `fact` |
| 12 | Rank 4 (regular hours) needs the regulations source fetched within 48 h, so without ingest every day is `unknown` | Build the fetch wrapper and the regulations adapter first in Phase 6; the private manual-data run (M2) starts then |

## Plan at a glance

v1 needs about 14–19 builder-days across nine phases, then a 14-day reconciliation run before the public launch. That is roughly 7–9 weekends, not the PRD's two: the later specs added a six-screen admin, a correctness loop and six integrations. Three milestones let real use begin before the build is finished.

| Phase | Effort | Exit gate (summary) | Milestone |
| --- | --- | --- | --- |
| 1 · Setup | About 1 day + discovery | CI deploys to preview; source questions answered | |
| 2 · Authentication | About half a day | /admin returns 403 without an Access token | |
| 3 · Database | About 1 day | Migrations apply on D1; constraint tests pass | |
| 4 · Core UI | About 2 days | Gallery signed off; P1 fits 360×640 with JS off | |
| 5 · Main features | 3–4 days | Override public in 60 s; golden suite passes | M1 · loop works on preview |
| 6 · Integrations | 3–5 days, least predictable | Shadow reports match; ≤ 1 request/source/hour | M2 · private live run |
| 7 · Testing | 1–2 days | Every acceptance item traced and green | |
| 8 · Deployment | About 1 day | Rollback under 1 min; a broken build never ships | |
| 9 · Polish and launch | 1–2 days + 14-day run | 14 matching days, zero wrong greens | M3 · public launch |

M2 is where the PRD's "manual data, real page" step happens. The site runs privately in production on curator overrides plus regular hours, while the closure scrapers stay in shadow mode.

## Phase 1 · Setup

Goal: a scaffolded repo deploying a placeholder Worker to `preview` from CI, and written answers to the source questions that could change the architecture. Effort: about 1 day of build plus the discovery spike.

**Steps**

1. **Accounts and prerequisites.** Cloudflare account with Workers, D1, KV, R2 and Zero Trust enabled; a domain on Cloudflare DNS; a GitHub repo; the curator's Google account; a contact address `contact@<domain>` via Email Routing; free API keys from the CWA and MOENV open-data portals. Store keys only in a password manager for now.
2. **Discovery spike** (answers the TRD's open questions; write results to `docs/sources-discovery.md`). For each candidate source record: URL, format (HTML listing, PDF, social post), `robots.txt` verdict, terms of use, how often it changes, whether it names 主場 and 暖身場 separately, and how far ahead meets appear. Also record: stadium coordinates, nearest MOENV station, CWA and MOENV dataset IDs. Draft (do not send) the email to the venue operator asking about machine-readable data; Katoku sends it.
3. **Start the manual source log.** Once a day, note what each source says and what the gate actually did. This is the PRD's step 2 at zero cost, and it becomes the first golden fixtures.
4. **Scaffold the repo** with the layout below. Node 22, TypeScript strict, ESLint with a rule banning `innerHTML`, `set:html` and `dangerouslySetInnerHTML`, Prettier, Vitest with `@cloudflare/vitest-pool-workers`, Wrangler.
5. **Wrangler config per Worker** (`workers/<name>/wrangler.jsonc`) with binding placeholders, an `ENVIRONMENT` var (`local` / `preview` / `production`) and a committed `.dev.vars.example`. No secrets in any committed file.
6. **CI skeleton** in GitHub Actions: install, typecheck, lint, test, build on every push; on a pull request, deploy to `preview`. The `web` Worker returns a one-line placeholder page with the TRD security headers.
7. **Project docs:** `docs/decisions.md` (pre-filled with the 12 rulings above), README with a dependency-justification table and empty runbook headings, `incidents/TEMPLATE.md`.

**Repo layout**

```text
src/shared/     time.ts  types.ts  schemas.ts (Zod)  copy.ts  sources.ts
src/resolver/   resolve.ts  weather.ts
src/ui/         Hono JSX components, tokens.css, base.css
src/db/         hand-written SQL, one file per table group
src/adapters/   one parser per source
workers/        web/  admin/  ingest/  publish/   (index.ts + wrangler.jsonc each)
migrations/     core/  push/ (v2)
fixtures/       payloads/  resolver/  snapshots/
tests/  e2e/  scripts/  jobs/pdf-parse/  incidents/  docs/  .github/workflows/
```

**Deliverables**

- Repo with the layout above, lint and typecheck passing
- `docs/sources-discovery.md` with every TRD open question answered or marked blocked
- CI workflow and a live `preview` URL serving the placeholder with security headers
- `docs/decisions.md`, README skeleton, `incidents/TEMPLATE.md`

**Exit gate**

- [ ] A pull request deploys to `preview` automatically and the URL responds with the CSP, HSTS, `nosniff` and `no-referrer` headers
- [ ] Every source in the discovery file has a `robots.txt` verdict; any disallowed source is marked disabled, not worked around
- [ ] Katoku has read the discovery file and confirmed whether the two tracks are announced separately

## Phase 2 · Authentication

Goal: `/admin*` is reachable only by the one curator and the PDF-parser service token, and the app contains no login, password or session code of its own. Visitors are never authenticated. Effort: about half a day. Sources: Backend Schema §Authentication, App Flow §Login and signup flow, TRD §Authentication.

**Steps**

1. **Cloudflare Access (dashboard, done once per environment).** Create a Zero Trust team, add Google as the identity provider, then an Access application `Track Status Admin` on `{DOMAIN}/admin*` with a policy allowing one email. Session 8 h, cookie `SameSite=Lax`. Set custom text: denied page `此帳號沒有管理權限。`, logout page `已登出。` with a link to `/`. Repeat for `preview` with its own application and `ACCESS_AUD`.
2. **Service token** for the external PDF job (`CF-Access-Client-Id` / `-Secret`), allowed by a second Access policy. Save it as a GitHub Actions secret; it is used in Phase 6.
3. **Worker secrets:** `ACCESS_AUD`, `ACCESS_TEAM_DOMAIN`, `CURATOR_EMAILS`, `PDF_PARSER_CLIENT_ID`.
4. **`requireAccess` middleware** in the `admin` Worker (Hono), run before every `/admin*` handler, exactly as the Schema's six verification steps:
   1. Read `Cf-Access-Jwt-Assertion` only; never trust the email header or the cookie alone.
   2. Fetch the team JWKS, cache it in isolate memory for 1 h, refetch once on an unknown `kid`.
   3. Verify RS256, `aud`, `iss`, `exp` and `nbf` with 60 s skew (use `jose`).
   4. Identity token: lowercase `email`, require it in `CURATOR_EMAILS`, else 403 (E-12).
   5. Service token: `common_name` must equal `PDF_PARSER_CLIENT_ID` and the route must be `POST /admin/facts`, else 403.
   6. Put `{actor, actor_kind}` on the request context; handlers never read the actor from the body.
5. **CSRF guard:** reject any admin `POST` unless `Sec-Fetch-Site: same-origin` or `Origin` equals `https://{DOMAIN}`.
6. **Local development bypass:** honour `ACCESS_DEV_EMAIL` only when `ENVIRONMENT=local`. A CI check fails the build if production config sets it.
7. **Admin stub:** `GET /admin` renders `管理後台` and the verified email; `登出` links to `/cdn-cgi/access/logout`. The 403 page uses copy E-12 with `重新登入` → `/admin`.
8. **Do not build** a signup page, a curator-management UI or any session table. Adding or removing a curator is the two-step README checklist: Access policy plus `CURATOR_EMAILS`, then `Revoke existing sessions`.

**Deliverables**

- Access applications and policies for `preview` and `production`, and the service token
- `src/auth/requireAccess.ts`, `src/auth/csrf.ts`, with unit tests using locally signed test JWTs
- Admin stub page and the E-12 page
- README runbook: add or remove a curator, rotate the service token

**Exit gate**

- [ ] Unit tests cover: valid curator, email not in allowlist, wrong `aud`, expired token, unknown `kid`, service token on `/admin/facts` (allowed) and on any other route (403)
- [ ] CI smoke test: `GET /admin/overrides` on `preview` without a token returns 403
- [ ] A cross-origin `POST` to `/admin/*` is rejected
- [ ] Katoku can sign in on a phone and sees their email on the stub page

## Phase 3 · Database and storage

Goal: the `tsb_core` D1 database, the `SNAPSHOTS` KV namespace and the `tsb-raw` R2 bucket exist in every environment, with the Backend Schema's constraints enforced by SQLite itself. Effort: about 1 day. Source: Backend Schema, all sections.

**Steps**

1. **Create resources** per environment: D1 `tsb_core` (binding `DB`), KV `SNAPSHOTS` (binding `KV`), R2 `tsb-raw` (binding `RAW`) with a 90-day lifecycle rule and no public access. Defer `tsb_push` to v2.
2. **Write `migrations/core/0001_init.sql`** from the Schema's table reference: all 18 tables, `STRICT`, every CHECK (dates round-trip through `date()`, epoch ms ≥ 2024-01-01, `HH:MM` times, 0/1 booleans), composite foreign keys, generated columns (`effective_expires_at`, `effective_ends_at`, `claim_changed`, `result`), the partial indexes in the index table, and the `RAISE(ABORT)` triggers for each mutability class (APPEND, SET-ONCE, column-split `reconciliation`).
3. **Write `migrations/core/0002_seed.sql`:** the two `venue` rows (`main`, `warmup`, with `name_zh` exactly as the operator writes it) and one `source` row per entry in `src/sources.ts`. Add a CI check that the seed and `sources.ts` match, since `source` is repo-owned config.
4. **Rebuild the constraint test suite** (the Schema cites 111 tests; the file is not in the folder). One test per rule at minimum: rejected bad date, rejected seconds-instead-of-ms, override without `expires_at`, `expires_at` more than 31 days out, UPDATE on an APPEND table, second `ended_at` on a SET-ONCE row, `fact.claim = 'unknown'`, duplicate `request_id`, curator write to `reconciliation.claimed_0600`, `fetch_run` over 2 MB.
5. **Apply on D1, not just SQLite.** Run `wrangler d1 migrations apply --local`, then on `preview`. Confirm D1 accepts `STRICT`, generated columns, partial indexes and the triggers (Schema open item). If one is rejected, record the workaround in `docs/decisions.md` and keep the rule in application code with a test.
6. **Data-access layer** in `src/db/`: typed functions with hand-written SQL, grouped as `ingestion`, `curator`, `resolution`, `correctness`, `audit`. Every write that must be atomic (override + audit, two rows for `兩者`) uses `DB.batch()`.
7. **KV and R2 helpers:** `putSnapshot(name, body, generatedAt)` writes the current key and the 14-day timestamped copy; `getCurrent(name)`; `putRaw(bytes)` returns `raw/<sha256>`.
8. **Check the hot queries** with `EXPLAIN QUERY PLAN` against the Schema's index table and keep the output in `docs/query-plans.md`.

**Deliverables**

- `migrations/core/0001_init.sql` and `0002_seed.sql`, applied locally and on `preview`
- Constraint test suite running in CI against local D1
- `src/db/*`, `src/storage/kv.ts`, `src/storage/r2.ts` with unit tests
- `docs/query-plans.md`

**Exit gate**

- [ ] Migrations apply cleanly on an empty local D1 and on `preview`
- [ ] Every constraint test passes, and each mutability class has at least one test proving UPDATE or DELETE aborts
- [ ] Each hot query uses its intended index

## Phase 4 · Core UI

Goal: every public screen renders correctly from a fixture `status.json`, with no backend, in light and dark mode and with JavaScript off. The admin component kit exists but is not wired to data. Effort: about 2 days. Sources: UI/UX Brief §12 build order, App Flow §Global state model and §Public screens.

**Steps**

1. **Copy file first.** `src/shared/copy.ts` holds every quoted string in the App Flow Spec, keyed by screen and ID (E-01…E-20, M-01…M-09, S-01…S-05), plus formatter functions for `M/D（週）`, `HH:MM` and durations (`2 小時 40 分`, `40 分`, `不到 1 分鐘`). Unit-test the formatters.
2. **Snapshot types.** `src/shared/types.ts`: `Claim`, `Confidence`, the `VenueDay` discriminated union from the TRD, and a Zod schema for `status.json`. A snapshot that fails the schema renders both venues as `unknown`.
3. **Styles.** Paste `tokens.css` from the UI/UX Brief §12 unchanged, add the base layer (reset, body type, focus ring, links, `tabular-nums`), and the `data-claim` / `data-confidence` rules. One CSS file, target under 8 KB gzipped.
4. **Icons.** One inline `<svg><symbol>` sprite of about 12 symbols: four status glyphs plus refresh, external link, map pin, warning, clock, info and shield-check.
5. **Hero component, then the gallery.** Build `VenueRow` and `DualLightCard` (Brief §6.1 anatomy: status edge, 48 px disc, state word, window, reason clamped to 2 lines, annotation clamped to 1, last-known, stamp). Then build `/dev/gallery`, rendering all 16 claim pairs × 4 confidence levels in both themes. Katoku reviews this page before anything else is built.
6. **Remaining public components:** SiteHeader, StaleBanner (amber and red), DisclaimerLine, SiteFooter, OutlookStrip and OutlookDetails, StateChip, ConditionsBlock, PracticalStrip, RecentChangeItem, Button, Link.
7. **Assemble screens from fixtures.** `renderHome(snapshot, now)`, `renderHistory(history)`, `renderAbout()`, `render404()`, `render503()` as pure functions returning HTML strings. Use 6 fixture snapshots: normal open day, main closed with warm-up open, both unknown, inferred meet weekend, stale over 48 h, weather missing.
8. **The inline script** (≤ 40 lines, no module): recompute window lines from `data-opens-at` / `data-closes-at` on load, on `visibilitychange` and every 30 s; apply E-02/E-03 from `data-generated-at`; reload once with `?r=` on a date mismatch, else show E-04; open `#outlook-details` on an outlook tap. It changes only window lines and the banner. Compute its `sha256-` hash at build and export it for the CSP header.
9. **Responsive layout** per Brief §9: `xs`, `sm` (baseline 360 × 640), `md`, and `lg` with the sticky answer zone. DOM order never changes.
10. **Admin component kit:** AdminTopBar, Flash, AlertCard, ClaimRadioTiles, SegmentedRadio, FormField, LivePreview (reusing `VenueRow`), StickyActionBar, SourceCard, DataTable, ResultChip.

**Deliverables**

- `copy.ts`, `types.ts`, `tokens.css`, the base CSS and the icon sprite
- All public and admin components in `src/ui/`, rendering through Hono JSX to strings
- `/dev/gallery` (preview and local only, 404 in production)
- P1, P2, P3, P5, P6 rendered from fixtures, and the inline script with its CSP hash

**Exit gate**

- [ ] Katoku has signed off the gallery in both themes
- [ ] At 360 × 640 the worst-case fixture (banner, 2-line reasons, annotations) keeps both state words, both window lines and the disclaimer above the fold (620 px budget in Brief §7)
- [ ] P1 is correct with JavaScript disabled, under 20 KB gzipped, with HTML and CSS as the only requests
- [ ] A greyscale screenshot still shows which venue is open
- [ ] A contrast script confirms text ≥ 4.5:1 and discs ≥ 3:1 against `--surface` in both themes
- [ ] No hard-coded UI string outside `copy.ts` (lint or grep check in CI)

## Phase 5 · Main features

Goal: the full write-and-read loop works on `preview`. A curator override becomes a public light within 60 seconds, every answer can be replayed from its inputs, and the correctness loop records what the page claimed. Effort: 3 to 4 days. Build the resolver and its fixtures before anything that calls it (TRD §Status resolution engine).

### 5A · Time module and resolver

1. **`src/shared/time.ts`:** `taipeiDate(instant)`, `taipeiHHMM(instant)`, `addDays(date, n)`, `instantAt(date, 'HH:MM')`. Taiwan has no daylight saving, so a fixed +08:00 offset is exact, but nothing else in the code may do date arithmetic. Test 05:59, 06:00, 23:59 and 00:00 Taipei, and the UTC day boundary at 08:00 Taipei.
2. **`src/resolver/resolve.ts`**, a pure function: `resolve(inputs, venue, date, now) → VenueDay`. No I/O, no clock of its own. Inputs and rules, in order:
   - Rank 1: unexpired overrides (`effective_expires_at > now`); newest `created_at` wins → `human_verified`. The only input that can raise a day to open.
   - Rank 2: active venue-notice facts, meaning facts from the newest `parsed` run per (source, document) → `confirmed`.
   - Rank 3: active competition-calendar facts → `inferred`.
   - Rank 4: active `hours_rule` rows matching weekday and date range, only if the regulations source succeeded within 48 h → `confirmed`, open.
   - Nothing speaks → `unknown`, carrying `lastKnown`.
   - Facts and rules from a source with an active `source_mute` are ignored.
   - Several facts at the same rank: the most restrictive wins (closed > partial > open).
3. **`src/resolver/weather.ts`**, applied after `resolve`: a typhoon flag can turn `open` into `unknown` or `closed` (per the operator's published rule), and can never upgrade anything.
4. **Golden fixtures** in `fixtures/resolver/`, each an input set with its expected `VenueDay`. At least 30: meet weekend, typhoon day, malformed page (no facts), page that changed shape, override over a notice closure, expired override, ended override, muted source, regulations last fetched 49 h ago, two same-rank facts disagreeing, a retracted notice that disappears on the next parse, warm-up known while main is unknown, and every real day from the Phase 1 manual log.

### 5B · Publish pipeline (`publish` Worker)

1. Triggers: cron every 30 min, service binding from `admin` and `ingest`, and `deploy` from CI. Each run opens a `publish_run` row (`running`) and closes it exactly once.
2. Load inputs once, resolve both venues for today through today + 7, upsert `venue_day`, prune past rows, and append a `transition` row for every change in (claim, confidence), including `first_seen`.
3. Set `stale = true` when no source has a successful fetch in 48 h.
4. Render `index.html`, `status.json`, `history.html`, `history.json` (and `feed.ics` only when `FEATURE_SUBSCRIBE=true`). Validate `status.json` against its Zod schema before writing.
5. Write each object to `snapshot:v1:current:<name>` and to `snapshot:v1:<generated_at>:<name>` (14-day TTL); update `health:v1`; mark the run `ok`.
6. For every non-cron trigger, purge `/`, `/history` and `/api/*` through the Cloudflare cache API and record `purge_outcome`.
7. Idempotence test: two runs with the same inputs produce the same `venue_day` rows and no duplicate transitions.

### 5C · Public read path (`web` Worker)

1. Route table: `/`, `/history`, `/about`, `/api/status.json`, `/api/history.json`, `/health`, 404. Each route is one KV read; the Worker has no D1 binding at all.
2. Missing `index.html` → P6 inlined in the Worker, HTTP 503, `Cache-Control: no-store` (E-01). Missing history → E-09.
3. Headers: the TRD CSP plus the inline-script hash, HSTS, `nosniff`, `no-referrer`; `s-maxage=300, stale-while-revalidate=3600` on public pages; `Access-Control-Allow-Origin: *` on `/api/*`; no `Set-Cookie` ever.
4. While `FEATURE_SUBSCRIBE=false`, `/subscribe`, `/feed.ics` and `/api/push/*` return 404.

### 5D · Curator flows (`admin` Worker)

1. **A1 Dashboard:** alerts, public preview using the real `VenueRow`, `新增覆寫` and `立即重新發布`, up to 3 active overrides, source health. Every POST ends in a 303 redirect with a `?flash=` code.
2. **A2 New override or annotation:** fields, defaults and error copy exactly as the App Flow table. One shared Zod schema validates on client and server. Guard dialogs for raising to open and for overlap. Draft saved to `sessionStorage` with its `request_id`; LivePreview renders the unclamped row plus the clamp warning. Submit: validate → `DB.batch` (override rows + audit) → publish with a 10 s timeout → purge → 303. Map failures to E-13 to E-17.
3. **A3 Overrides list:** active, scheduled, expired in 30 days. `立即結束` sets `ended_at` once; `複製為新覆寫` prefills A2. No edit, no delete.
4. **A6 Audit log:** newest first, 50 per page via `?before={id}`, filter by action.

### 5E · Correctness loop

1. **18:30 Taipei job** (cron `30 10 * * *` UTC in `publish`): write each venue's `reconciliation` row from `transition`, recording the claim in force at 06:00 and 18:00.
2. **A5 Reconciliation screen:** last 14 days, an `實際狀況` select per row, the `連續相符 {n} / 14 天` progress bar, and the false-green alert.
3. **Alerts:** raise with `dedupe_key` for `publish_failed`, `claim_flip_flop` (more than 2 flips a day), `override_share` (over 30% across 14 days), `false_green` and `rebuild_mismatch`. Email delivery arrives in Phase 6; until then alerts show on A1.
4. **Nightly rebuild check:** recompute `venue_day` at each row's stored `resolved_at` and raise `rebuild_mismatch` on any difference.

**Deliverables**

- `time.ts`, `resolve.ts`, `weather.ts` and at least 30 golden fixtures
- `publish`, `web` and `admin` Workers deployed to `preview` with real D1 and KV
- Admin screens A1, A2, A3, A5, A6 and the reconciliation and alert jobs
- `docs/decisions.md` entry with the measured override-to-public latency

**Exit gate**

- [ ] The golden suite passes with full branch coverage of `resolve.ts`; no fixture produces open from a malformed or missing input
- [ ] Publishing twice in a row changes nothing, and the nightly rebuild check passes
- [ ] On `preview`, an override entered on a phone shows on `/` within 60 s in 10 of 10 tries; if KV propagation breaks this, record the fix (for example, `web` reading with a short `cacheTtl`) before moving on
- [ ] Raising a closed or unknown day to open always shows the guard dialog, and every admin write creates exactly one audit row per affected record
- [ ] The `web` Worker config has no D1 binding (CI check)

## Phase 6 · Integrations

Goal: real sources feed the resolver politely and fail honestly. Each new parser runs in shadow mode before it can change a light. Effort: 3 to 5 days, the least predictable phase, because it depends on what the Phase 1 discovery found. Sources: TRD §APIs consumed and polling contract, PRD §Data sourcing and integrity.

**Steps**

1. **Shared fetch wrapper** `src/ingest/fetch.ts`, the only code allowed to call an external host:
   - Host allowlist read from `src/sources.ts`, never from the database or an admin request (SSRF guard).
   - `If-None-Match` and `If-Modified-Since` on every request; a 304 is a success that costs one `fetch_run` row.
   - `User-Agent: TaipeiTrackStatus/1.0 (+https://<domain>/about; contact@<domain>)`, 10 s timeout, stream aborted at 2 MB.
   - Raw bytes to R2 as `raw/<sha256>`; one `fetch_run` row per attempt with its outcome; `source_state` updated; query strings containing `apikey` redacted in logs.
   - Exponential backoff on non-200; 2 consecutive failures → `source_degraded` alert; 3 → hard stop and E-19 until the curator clears it.
   - `robots.txt` re-checked weekly; a disallow disables the source.
   - In `local` and `preview`, real hosts are refused unless `ALLOW_REAL_FETCH=1`.
2. **`ingest` dispatcher:** cron every 5 minutes; fetch only sources whose `cron_minute` falls in the current bucket and whose `min_interval_s` has passed. When a run produces new or changed facts, call `publish` over the service binding.
3. **Adapter contract:** `parse(bytes, meta) → Result<Fact[] | HoursRule[] | Reading, ShapeError>`. Assert the page shape with Zod first; any surprise returns `ShapeError`, records `shape_error` and raises `parse_shape`. Record `parser_version` (git short SHA) on every run.
4. **Close a gap the specs leave open.** The TRD says a failed covering source resolves to `unknown`, but the resolver inputs in the Schema do not include source failure, so stale facts from the last good parse would stay active. Add `on_failure: 'unknown' | 'keep'` per source in `sources.ts` (venue notice `unknown`, competition calendar `keep`, per the TRD table), pass each source's latest run outcome into `resolve()`, and add fixtures for both.
5. **Shadow mode first.** Every adapter ships with `mode: 'shadow'` and runs at least 7 days, writing a parse report to compare against the manual log. Switching to `live` is a pull request that links the report.
6. **Adapters, in this order:**
   1. Regulations page → `hours_rule` (rank 4). Once this is live, start milestone M2: a private production run on overrides plus regular hours.
   2. Venue notice listing (臺北體育園區) → rank-2 facts, one `document_key` per notice, `source_published_on` filled.
   3. Competition calendar (田徑協會 and city meets) → rank-3 facts; PDF detail goes to step 7.
   4. data.gov.tw venue dataset → `practical_info`, weekly.
   5. CWA → `weather_reading` and the typhoon flag, hourly; conditions hidden after 3 h (E-06).
   6. MOENV → `air_quality_reading`; AQI chip hidden after 3 h (E-07).
7. **External PDF job** in `jobs/pdf-parse/`: a scheduled GitHub Actions workflow on Node 22 with `pdfjs-dist`. It opens a PDF only when its listing entry changed and posts facts to `POST /admin/facts` with the service token. The endpoint validates with Zod and writes `fetch_run` (`origin = 'external'`), the facts and a `facts.submit` audit row.
8. **A4 Sources screen:** source cards, mute with the impact line (resolver run without that source over the next 7 days), unmute, clear failures, and fetch now with the E-18 interval guard. Robots-disabled sources show `已停用` and no actions.
9. **Email:** alerts and a weekly digest (reconciliation table, override count, unknown rate) to the curator, using the Cloudflare Email Workers `send_email` binding to a verified address. Confirm your plan's cron-trigger quota before adding the digest schedule.
10. **P3 About:** fill the sources list with links and `每小時最多一次`, plus the operator contact line.

**Deliverables**

- `fetch.ts`, the `ingest` Worker and six adapters, each with at least 3 saved payload fixtures
- `on_failure` support in the resolver, with fixtures
- Shadow reports in `docs/shadow/` for every source switched to live
- PDF job, `POST /admin/facts`, A4 screen, alert email and weekly digest

**Exit gate**

- [ ] Fixtures per adapter include a malformed page and a payload with embedded markup; a 50 MB response is cut at 2 MB
- [ ] Over 48 h on `preview`, `fetch_run` shows no more than one request per source per hour, and 304s are recorded
- [ ] Blocking a source host gives `降級` after 2 failures, a hard stop and E-19 after 3, and `狀態未確認` on the days that source covers
- [ ] Each live source's shadow report matches the manual log, or each difference is explained
- [ ] A test alert email arrives in the curator's inbox

## Phase 7 · Testing

Goal: every acceptance criterion in the App Flow Spec and the UI/UX Brief is tied to an automated test or a named manual check, and the whole suite gates every merge. Tests are written inside each earlier phase; this phase fills the gaps and hardens the suite. Effort: 1 to 2 days.

**Test layers**

| Layer | What it proves | Tool | Runs |
| --- | --- | --- | --- |
| Resolver golden fixtures | Precedence, fail-closed, weather never upgrades, `on_failure` | Vitest | Every push |
| Schema constraints | Mutability classes, CHECKs, generated columns, idempotency keys | Vitest + local D1 | Every push |
| Unit | Time module, copy formatters, phase table, freshness rules, JWT middleware, fetch wrapper | Vitest | Every push |
| Parser fixtures | Each adapter on saved payloads, malformed pages, markup injection, oversized responses | Vitest | Every push |
| Integration | Seeded D1 → `publish` → KV objects → `status.json` valid against its schema; publish twice is a no-op | `@cloudflare/vitest-pool-workers` | Every push |
| End-to-end | P1 at 360 × 640 with JS off and on, fold check, 16 claim pairs, E-02/E-03/E-04 with a mocked clock, wake-from-yesterday reload, A2 override reaching `/` | Playwright | Every PR, on `preview` |
| Accessibility | Landmarks, labels, contrast, forced colours, keyboard-only admin | `@axe-core/playwright` + contrast script | Every PR |
| Budget | No JS bundle on `/`, HTML under 20 KB gzipped, CSS under 8 KB, 2 requests | `scripts/budget-check.ts` | Every push |
| Security | 403 on `/admin/*` without a token, headers present, no `Set-Cookie`, no third-party requests, fetch to a non-allowlisted host refused | Smoke script + Playwright | Every deploy |

**Steps**

1. Create `docs/acceptance.md`: one row per acceptance item from the App Flow Spec (18 items) and the UI/UX Brief (12 items), each linked to its test file or manual step.
2. Add the missing tests until every row has an owner. Pay most attention to anything that could produce a wrong green.
3. Add a load test: a 50 MB response and a pathological HTML document against the fetch wrapper and each parser, asserting the time and size limits hold.
4. Run the manual checks below on real devices and record the results in `docs/acceptance.md`.

**Manual checks**

- VoiceOver (iOS, zh-TW voice) and TalkBack read each light as `主場：開放` and similar, and skip the decorative glyphs
- Outdoors at about 08:00, 50% brightness, arm's length: both state words readable, amber distinguishable from red
- 200% zoom and iOS Dynamic Type XXL: no horizontal scroll, state words still first in reading order
- Windows forced-colours mode and a greyscale screenshot: the states still read from glyph and word alone
- Curator flow on a phone at 360 px: sign in, publish an override, end it, all one-handed

**Deliverables**

- Full CI suite gating merges, plus `docs/acceptance.md` with every item traced
- Load-test results and manual-check records

**Exit gate**

- [ ] Every acceptance item is green or has a written, accepted exception
- [ ] CI blocks a merge on any failing layer above
- [ ] Zero known paths to a wrong green

## Phase 8 · Deployment

Goal: a push to `main` deploys production through one pipeline, any bad release can be undone in seconds, and nothing is changed by hand in a dashboard except the Access policy and secrets. Production can go live privately as early as milestone M2; this phase makes it robust. Effort: about 1 day. Source: TRD §Deployment and environments.

**Steps**

1. **Production resources:** D1 `tsb_core`, KV `SNAPSHOTS`, R2 `tsb-raw` (90-day lifecycle), Worker routes on `{DOMAIN}` (`admin` on `/admin*`, `web` on everything else), the production Access application, and Workers secrets (`ACCESS_AUD`, `ACCESS_TEAM_DOMAIN`, `CURATOR_EMAILS`, `PDF_PARSER_CLIENT_ID`, CWA and MOENV keys, cache-purge token).
2. **Pipeline on push to `main`**, in this order: typecheck → unit and fixture tests → build → budget check → `wrangler d1 migrations apply` → deploy `publish`, `ingest`, `admin`, `web` → smoke test (`/health`, `/api/status.json` against its schema, 403 on `/admin/overrides`, headers) → republish with `trigger_kind = 'deploy'`. Any failed step leaves the previous Worker version and the previous snapshot serving.
3. **Cron schedules** (Workers cron runs in UTC; keep a Taipei comment beside each):

| Worker | Cron (UTC) | Taipei time | Job |
| --- | --- | --- | --- |
| `ingest` | `*/5 * * * *` | every 5 min | Dispatch sources whose minute bucket is due |
| `publish` | `*/30 * * * *` | every 30 min | Scheduled publish, no purge |
| `publish` | `30 10 * * *` | 18:30 daily | Write reconciliation rows |
| `publish` | `0 19 * * *` | 03:00 daily | Nightly rebuild check |
| `publish` | `0 23 * * 0` | Mon 07:00 | Weekly digest email |

4. **Rollback, two independent levers:** `wrangler rollback` per Worker for code; `scripts/rollback-snapshot.ts <timestamp>` copies `snapshot:v1:<ts>:*` over `snapshot:v1:current:*`, then purges the CDN. Rehearse both on `preview`.
5. **Migrations rule:** forward-only and additive, run only by CI, never from a laptop.
6. **README runbooks:** rotate an API key (about 15 minutes), add or remove a curator, roll back code or a snapshot, clear a hard-stopped source, write a false-green incident, and handle an operator request to stop fetching within 48 hours.
7. **Cost check:** confirm the workload fits the Cloudflare free tier and note the expected cost (domain about NT$400–800 a year) in the README.

**Deliverables**

- Production environment serving `{DOMAIN}` with Access on `/admin*`
- Deploy workflow with smoke tests and automatic republish
- Rollback scripts, rehearsed, and the six runbooks

**Exit gate**

- [ ] A deliberately broken build on a branch never reaches production
- [ ] Snapshot rollback restores the previous page in under 1 minute on `preview`
- [ ] Production `/health` shows every live source fetched within its interval
- [ ] No secret appears in the repo, the Wrangler config or the logs (secret scanning on)

## Phase 9 · Final polish and launch

Goal: the PRD's definition of done. For 14 consecutive days the 06:00 answer matches the gate, with every mismatch logged and explained, before anyone outside one club hears about the site. Effort: 1 to 2 days of polish, then 14 calendar days of observation needing about 2 minutes a day.

**Steps**

1. **Copy pass.** Katoku reads every string in `copy.ts` aloud in context on a phone: venue names exactly as the operator writes them, full-width punctuation intact, no exclamation marks, the disclaimer on P1 and P2.
2. **Visual pass.** Re-check the gallery and P1 in both themes, the `lg` sticky answer zone, the A1/A2 previews, and the dashed ring on inferred states. Fix anything that drifted from the UI/UX Brief tokens.
3. **Performance pass.** On a throttled 4G profile, first meaningful paint under 1.5 s; re-run the budget check.
4. **Operator courtesy.** Make sure the operator email has been sent and the P3 contact line promises a 48-hour response.
5. **Closed beta.** Share the URL with five runners from one club only. Ask them to report any wrong answer straight to the curator; log each one on A5.
6. **14-day reconciliation run.** The curator fills A5 every evening. Any false green resets the streak and triggers an incident write-up in `incidents/`, a new golden fixture, and a resolver or source-rank fix.
7. **Public launch.** Only after the gate below passes: share in LINE groups and running communities.
8. **First month after launch.** Read the weekly digest; if the override share stays above 30%, stop adding features and fix the parsers.

**Launch criteria (from the PRD)**

| Metric | Target | Measured from |
| --- | --- | --- |
| Consecutive matching days at 06:00 | 14 | A5 progress bar |
| Status accuracy at 06:00 and 18:00 | ≥ 98% of venue-days | `reconciliation.result` |
| Wrong greens | 0 | `reconciliation.result = false_green` |
| Unknown rate | < 10% of venue-days | `venue_day` history |
| Override share | < 30% over 14 days | `override_share` alert |
| Time to answer | p75 under 3 s from tap to decision | Timed with the beta runners |
| Qualitative bar | Five runners use it for a month without asking a LINE group first | Beta check-in |

The PRD's return-rate and per-page-load freshness metrics need visitor identifiers or analytics, which the TRD forbids; v1 uses the qualitative bar and the publish-side freshness in `/health` instead (decision D-4).

**Deliverables**

- Polished copy and visuals, signed off by Katoku
- 14-day reconciliation record and any incident write-ups
- Launch note in `docs/decisions.md` with the final metric values

**Exit gate**

- [ ] Every launch criterion above is met
- [ ] No open red alert on A1
- [ ] Katoku approves the public launch

## Decisions for Katoku and post-v1 backlog

Seven decisions are needed. D-1 and D-5 block Phase 2 and Phase 4; the rest can wait for the phase named.

| # | Decision | Recommendation | Needed by |
| --- | --- | --- | --- |
| D-1 | Rendering technology: Hono JSX everywhere, or keep Astro for static pages | Hono JSX everywhere. One component set renders in `publish`, `admin` and the A2 preview; Astro would add a second template system for two static pages | Phase 4 |
| D-2 | Admin scope versus the PRD's two-weekend MVP, which imagined an override row in a config file | Keep A1, A2, A3 and A5 for launch, since they carry the 60-second promise and the done metric; A4 and A6 may land after M2 | Phase 5 |
| D-3 | What to show if notices never name the warm-up track separately | Render 暖身場 as `狀態未確認` unless an override speaks, and say so on P3; do not copy the main-track state across | After Phase 1 discovery |
| D-4 | PRD metrics that need analytics (return rate, per-load freshness) | Replace them with the qualitative bar and publish-side freshness; add cookieless request-log counts later only if wanted | Phase 9 |
| D-5 | Access login method | Google, as specified. It needs a Google OAuth client; Access one-time PIN to email is a simpler fallback with the same security for one user | Phase 2 |
| D-6 | English venue names | Use the operator's official English names if they exist; otherwise keep `Main track` / `Warm-up track` | Phase 9 |
| D-7 | Outlook length | Keep 7 days if meets are published weeks ahead; shorten to 3 if the discovery shows only days of lead time (TRD open question) | Phase 6 |

**Post-v1 backlog** (all behind flags or deferred by the PRD)

- v2 change subscription: P4 `/subscribe`, web push with the `tsb_push` database and `push` Worker, the iCal feed, iOS home-screen manifest, and the delivery rules in the App Flow Spec
- On-site confirmation (PRD feature 10)
- A venue filter on P2 `/history`
- An operator-provided machine-readable feed, if the email in Phase 1 turns one up; it would outrank the HTML scrapers
- A second venue, only after one venue pair has a quarter with zero wrong greens
