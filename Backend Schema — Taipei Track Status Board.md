# Backend Schema — Taipei Track Status Board

Nov 6, 2026 · @Katoku

## Scope and decisions

The backend is two D1 databases, one KV namespace and one R2 bucket, with 18 tables in `tsb_core` and 4 in `tsb_push` (v2). It implements the TRD's data model and the App Flow Spec's additions. Where those left a gap or a conflict, this spec marks the fix as **Addition** or **Resolution**. The DDL is in `migrations/core/0001_init.sql` and `migrations/push/0001_init.sql`. 111 constraint tests pass against SQLite 3.53 with foreign keys on.

| Store | Binding | Holds | Read path? |
| --- | --- | --- | --- |
| D1 `tsb_core` | `DB` | Sources, fetch runs, facts, overrides, annotations, mutes, resolved status, transitions, reconciliation, alerts, audit | No |
| D1 `tsb_push` (v2) | `PUSH_DB` | Push subscriptions, chosen venues, notified state, delivery outbox | Only `/api/push/*` |
| KV `SNAPSHOTS` | `KV` | Rendered HTML, JSON, iCal and health objects | Yes: every public request |
| R2 `tsb-raw` | `RAW` | Raw fetched bytes keyed by SHA-256, 90-day lifecycle | No, forensics only |

**Conventions, enforced by CHECK constraints.** Every table is `STRICT`. A Taipei calendar date is `TEXT 'YYYY-MM-DD'` and must round-trip through `date()`, so `2026-02-30` is rejected. An instant is `INTEGER` epoch milliseconds, and must be at least 2024-01-01, so a value in seconds is rejected. A wall-clock time is `TEXT 'HH:MM'`. A boolean is `INTEGER 0/1`.

**Design decisions beyond the TRD**

| # | Type | Decision | Why |
| --- | --- | --- | --- |
| 1 | Resolution | Split `source` (repo-owned config) from `source_state` (ingest-owned runtime state) | Config and state never share a writer, so the admin API can never touch a URL |
| 2 | Resolution | Replace `source.muted_until` with an append-only `source_mute` table | A mutable column makes resolver inputs unreplayable. Mute history is an input |
| 3 | Resolution | Overrides, annotations and mutes are ended by setting `ended_at` once. `expires_at` never changes | The spec's "set `expires_at = now`" loses the original expiry. A generated `effective_expires_at` gives the same query |
| 4 | Addition | `hours_rule` table for rank 4 (regular 08:00–22:00) | A rule cannot be a per-date fact: a 304 would leave future dates uncovered |
| 5 | Addition | `fetch_run.document_key`. Active facts = facts of the newest `parsed` run per (source, document) | A retracted notice disappears on the next parse instead of lingering forever |
| 6 | Resolution | Several facts from one run may cover the same venue-day. Within a rank, the most restrictive claim wins (closed > partial > open) | Fail-closed when one listing holds both a meet notice and a maintenance notice |
| 7 | Addition | `transition` logs every resolved-state change, including first appearance | One log answers the change log, "claim at 06:00" for reconciliation, flip-flop alerts and override share |
| 8 | Addition | `publish_run`, `alert`, `weather_reading`, `air_quality_reading`, `practical_info` | A1 alerts, E-20 codes and the conditions/practical blocks need somewhere to live |
| 9 | Addition | `request_id` idempotency key on every curator write | A double tap on `發布` hits a UNIQUE index and is treated as success |
| 10 | Addition | Worker-side `CURATOR_EMAILS` allowlist on top of the Access JWT check | `aud` proves the request passed Access, not that the policy is right |
| 11 | Addition | v2 push data in its own D1 database | D1 has no table-level grants. The binding is the only permission boundary for the one public write path |
| 12 | Resolution | The public read path, including `/health`, reads KV only, never D1 | Keeps TRD decision #1 true for every public route |

## Entity map

&#91;embedded content: entity map · 18 core tables in 5 groups, plus the v2 push database\]

Data flows one way: append-only and set-once inputs feed one pure resolver, whose outputs can be dropped and rebuilt. Every foreign key points back up this picture, from outputs to inputs and from inputs to `venue`/`source`, never sideways between curator and ingest data.

## Table reference

Each table lists its mutability class: **APPEND** (insert-only; UPDATE and DELETE abort by trigger), **SET-ONCE** (insert-only except `ended_at`/`ended_by`, filled once), **STATE** (mutable, one writer), **CACHE** (derived, rebuildable) or **CONFIG** (written only by migrations). `epoch ms` means `INTEGER` with the ≥ 2024-01-01 check.

### Reference and ingestion

**`venue`** · CONFIG · seeded with `main` and `warmup`

| Column | Type | Null | Key / constraint |
| --- | --- | --- | --- |
| `id` | TEXT | No | PK; `IN ('main','warmup')` |
| `name_zh` | TEXT | No | Exactly as the operator writes it |
| `label_zh`, `label_en` | TEXT | No | `主場` / `Main track`; prefix of every `aria-label` |
| `sort_order` | INTEGER | No | UNIQUE; main renders first |

**`source`** · CONFIG · mirrors the committed allowlist in `src/sources.ts`

| Column | Type | Null | Key / constraint |
| --- | --- | --- | --- |
| `id` | TEXT | No | PK; lowercase slug, e.g. `venue-notice` |
| `name` | TEXT | No |  |
| `kind` | TEXT | No | `venue_notice` (rank 2) · `competition_calendar` (rank 3) · `regulations` (rank 4) · `open_data` · `cwa` · `moenv` |
| `url` | TEXT | No | UNIQUE; `https://` only |
| `enabled` | INTEGER | No | 0/1, default 1 |
| `min_interval_s` | INTEGER | No | Default 3600; `≥ 3600`, so the PRD's one-request-per-hour cap is a schema rule |
| `cron_minute` | INTEGER | No | 0–59, staggered per source |
| `created_at` | epoch ms | No |  |

**`source_state`** · STATE · writer: `ingest`

| Column | Type | Null | Key / constraint |
| --- | --- | --- | --- |
| `source_id` | TEXT | No | PK; FK → `source.id` RESTRICT |
| `robots_ok`, `robots_checked_at` | INTEGER, epoch ms | No, Yes | Re-checked weekly; 0 disables the source |
| `last_etag`, `last_modified` | TEXT | Yes | Echoed back verbatim on the next request |
| `consecutive_failures` | INTEGER | No | ≥ 0. 2 = degraded, 3 = hard stop (E-19) |
| `backoff_until`, `last_attempt_at`, `last_success_at` | epoch ms | Yes | Success = parsed 200 or 304 |
| `last_http_status` | INTEGER | Yes | 100–599 |
| `updated_at` | epoch ms | No |  |

**`source_mute`** · SET-ONCE · writer: `admin`

| Column | Type | Null | Key / constraint |
| --- | --- | --- | --- |
| `id` | INTEGER | No | PK |
| `request_id` | TEXT | No | UNIQUE idempotency key |
| `source_id` | TEXT | No | FK → `source.id` RESTRICT |
| `starts_at`, `ends_at` | epoch ms | No | `ends_at > starts_at`, at most 7 days later |
| `reason` | TEXT | No | 1–100 characters |
| `created_by`, `created_at` | TEXT, epoch ms | No | Access email |
| `ended_at`, `ended_by` | epoch ms, TEXT | Yes | Both or neither; set once by `解除靜音` |
| `effective_ends_at` | INTEGER | — | Generated, stored: `MIN(ended_at, ends_at)` |

**`fetch_run`** · APPEND · writer: `ingest`, or `admin` for service-token submissions

| Column | Type | Null | Key / constraint |
| --- | --- | --- | --- |
| `id` | INTEGER | No | PK; also `UNIQUE (id, source_id)` as a composite-FK target |
| `source_id` | TEXT | No | FK → `source.id` RESTRICT |
| `document_key` | TEXT | No | Default `''` (the listing); a stable key per linked PDF or page |
| `document_url` | TEXT | Yes | `https://` |
| `origin`, `trigger_kind` | TEXT | No | `worker`/`external`; `cron`/`manual`/`external`. External origin ⇔ external trigger |
| `started_at`, `finished_at` | epoch ms | No | `finished_at ≥ started_at`; `UNIQUE (source_id, document_key, started_at)` makes retries idempotent |
| `http_status`, `bytes` | INTEGER | Yes | `bytes ≤ 2,097,152` (2 MB cap) |
| `content_sha256`, `r2_key` | TEXT | Yes | 64 hex chars; `r2_key = 'raw/' ‖ content_sha256` |
| `outcome` | TEXT | No | `parsed` · `not_modified` · `http_error` · `network_error` · `timeout` · `too_large` · `shape_error` · `robots_disallowed`. `parsed` requires 200, a hash and a parser version |
| `error` | TEXT | Yes | ≤ 2,000 characters, query strings with `apikey` redacted |
| `parser_version` | TEXT | Yes | Git short SHA, so any answer replays against the parser that made it |

**`fact`** · APPEND · writer: `ingest` (rank 2 and rank 3 only)

| Column | Type | Null | Key / constraint |
| --- | --- | --- | --- |
| `id` | INTEGER | No | PK |
| `fetch_run_id`, `source_id` | INTEGER, TEXT | No | Composite FK → `fetch_run (id, source_id)`; the run must be `parsed` (trigger) |
| `venue` | TEXT | No | FK → `venue.id` |
| `date` | TEXT | No | Taipei date |
| `claim` | TEXT | No | `open` · `partial` · `closed`. Never `unknown`: unknown is the absence of a fact |
| `window_start`, `window_end` | TEXT | Yes | Required ⇔ claim is open or partial; start < end |
| `reason_text` | TEXT | Yes | 1–120 characters; required when closed |
| `source_url` | TEXT | No | `https://` |
| `source_published_on` | TEXT | Yes | Taipei date. **Addition:** the stamp `依場館公告 · {M/D}` needs it |
| `confidence` | TEXT | No | `confirmed` or `inferred`; a trigger checks it matches the source kind |
| `extracted_at` | epoch ms | No |  |

**`hours_rule`** · APPEND · Addition · from the `regulations` source only (trigger)

| Column | Type | Null | Key / constraint |
| --- | --- | --- | --- |
| `id` | INTEGER | No | PK |
| `fetch_run_id`, `source_id` | INTEGER, TEXT | No | Composite FK → `fetch_run` |
| `venue` | TEXT | No | FK → `venue.id` |
| `weekday_mask` | INTEGER | No | 1–127; bit 0 = Monday |
| `window_start`, `window_end` | TEXT | No | start < end |
| `effective_from`, `effective_to` | TEXT | No, Yes | Taipei dates; to ≥ from |
| `source_url`, `extracted_at` | TEXT, epoch ms | No | Feeds `查看規定` |

**`weather_reading`**, **`air_quality_reading`**, **`practical_info`** · APPEND · Addition. Each carries `fetch_run_id` + `source_id` as a composite FK, and a trigger pins it to the `cwa`, `moenv` or `open_data` source kind.

| Table | Payload columns |
| --- | --- |
| `weather_reading` | `station_id` TEXT, `observed_at` epoch ms, `temp_c` REAL (−10–50), `humidity_pct` and `rain_prob_pct` INTEGER (0–100), `typhoon_warning` 0/1 |
| `air_quality_reading` | `station_name` TEXT, `observed_at` epoch ms, `aqi` INTEGER (0–500), `category_zh` TEXT |
| `practical_info` | `entrance_text`, `public_fee_text`, `reserved_lanes_text`, `floodlight_hours_text` (each ≤ 200), `extracted_at` |

## Indexes

Every index exists for a named query; none are speculative. The hot queries were checked with `EXPLAIN QUERY PLAN` and each searches its intended index.

| Index | Columns (partial filter) | Serves |
| --- | --- | --- |
| `fetch_run_parsed` | `(source_id, document_key, id DESC)` where `outcome = 'parsed'` | Resolver: newest parsed run per document, i.e. the active facts |
| `fetch_run_by_source_doc` | `(source_id, document_key, id DESC)` | Ingest: last run for backoff and conditional headers |
| `fetch_run_by_source_time` | `(source_id, started_at DESC)` | A4 `最近抓取`, `/health` |
| `fact_by_venue_date` | `(venue, date)` | Resolver: facts for today to today + 7 |
| `fact_by_run` | `(fetch_run_id, venue, date)` | Forensics: what one run produced |
| `override_active` | `(venue, date_from, date_to, effective_expires_at, created_at DESC)` | Resolver: unexpired overrides for a venue-day, newest wins |
| `override_by_expiry`, `annotation_by_expiry` | `(effective_expires_at DESC)` | A3 sections: active, scheduled, expired in 30 days |
| `annotation_active` | `(venue, date_from, date_to, effective_expires_at)` | Renderer: `註：{text}` |
| `source_mute_active` | `(source_id, effective_ends_at DESC)` | Resolver: is this source muted now |
| `hours_rule_by_run` | `(fetch_run_id)` | Resolver: rules from the active regulations run |
| `weather_latest`, `aqi_latest`, `practical_latest` | `(observed_at DESC)` / `(extracted_at DESC)` | Publish: newest reading; E-06/E-07 age check |
| `transition_public` | `(detected_at DESC)` where `claim_changed = 1` | P1 element 8, P2, `/api/history.json` |
| `transition_by_venue_day` | `(venue, date, detected_at DESC)` | Claim at 06:00/18:00; flips per day for the flip-flop alert |
| `publish_run_ok` | `(id DESC)` where `outcome = 'ok'` | A1 `快照 {generated_at}`, health object |
| `reconciliation_by_date` | `(date DESC)` | A5 last 14 days, `連續相符` streak |
| `alert_one_open` | UNIQUE `(dedupe_key)` where `resolved_at IS NULL` | Idempotent alert raising |
| `alert_open_by_time` | `(opened_at DESC)` where `resolved_at IS NULL` | A1 alert cards |
| `audit_by_action` | `(action, id DESC)` | A6 `?action=` filter with `action IN (…)` |
| `audit_by_entity` | `(entity_table, entity_id)` | "Who touched this override?" |
| `push_sub_venue_by_venue` | `(venue, subscription_id)` | Publish: subscribers of a venue |
| `push_delivery_queue` | `(queued_at)` where `outcome = 'queued'` | 1-minute drain cron |
| `push_delivery_weekly` | `(subscription_id, sent_at)` where change and sent | Counter-metric: > 2 per subscriber per week |

At about 3,000 venue-day rows and 9,000 fetch rows a year, write amplification from these indexes is negligible.

## KV and R2 key schema

The public Worker answers every route from one KV read, and KV holds only rendered output that anyone may see. **Resolution:** the TRD's pointer at `snapshot:v1:current` would cost two eventually-consistent reads per request, so `publish` writes the current objects directly and keeps timestamped copies for rollback.

| Key | Value | Writer | TTL | Served at |
| --- | --- | --- | --- | --- |
| `snapshot:v1:current:index.html` | P1 HTML | `publish` | None | `/` |
| `snapshot:v1:current:status.json` | Snapshot JSON (TRD shape) | `publish` | None | `/api/status.json` |
| `snapshot:v1:current:history.html` | P2 HTML | `publish` | None | `/history` |
| `snapshot:v1:current:history.json` | Last 30 days of claim changes | `publish` | None | `/api/history.json` |
| `snapshot:v1:current:feed.ics` | Closed and partial days (v2) | `publish` | None | `/feed.ics` |
| `snapshot:v1:<generated_at ms>:<name>` | Copy of each object above | `publish` | 14 days | Rollback only |
| `health:v1` | Per-source `last_success_at`, last publish `generated_at` | `ingest`, `publish` | None | `/health`; ages computed per request |

**Rollback** copies `snapshot:v1:<ts>:*` over `snapshot:v1:current:*` with a `wrangler` script, then purges the CDN. Each `publish` writes all five objects before it marks `publish_run` as `ok`. A missing `index.html` at read time is E-01 (P6, 503).

**R2 `tsb-raw`.** Key `raw/<sha256>`, the bytes exactly as fetched, with a 90-day lifecycle rule. Content addressing deduplicates identical payloads. The bucket is never public, and no Worker route serves it. `fetch_run.r2_key` may outlive its object; that is expected after 90 days.

## Authentication and session handling

The app stores no users, passwords or sessions, and the schema has no `user` or `session` table on purpose. Identity is a per-request fact: Cloudflare Access issues it, the Worker verifies it, and the verified email is copied into `created_by`, `ended_by`, `filled_by` and `audit.actor` as plain text, not a foreign key.

| Principal | Credential | Session | Stored as |
| --- | --- | --- | --- |
| Visitor | None | None. Public responses never set a cookie | Nothing |
| Curator | Access identity JWT (one Google account) | `CF_Authorization` cookie, 8 h, revocable in the Access dashboard | Email string |
| External parser | Access service token (`CF-Access-Client-Id` / `-Secret`) | Per request | `svc:<common_name>` |
| Cron jobs | None; invoked by the Workers runtime, not over HTTP | — | `cron` / `ingest` in `publish_run.triggered_by` |
| Subscriber (v2) | Possession of the push `endpoint` and its `keys.auth` | None | A `push_subscription` row |

**Curator request verification** (middleware on every `/admin*` route, before any handler)

1. Read the `Cf-Access-Jwt-Assertion` header. Never trust `Cf-Access-Authenticated-User-Email` or the cookie on their own.
2. Find the token's `kid` in the team JWKS at `https://<team>.cloudflareaccess.com/cdn-cgi/access/certs`. Cache the key set in isolate memory for 1 hour, and refetch once on an unknown `kid`.
3. Verify the RS256 signature, `aud` contains `ACCESS_AUD`, `iss` equals the team domain, and `exp`/`nbf` against the clock with 60 s of skew.
4. If the token has `email`: lowercase it and require it in the `CURATOR_EMAILS` secret. Otherwise return 403 (E-12).
5. If the token has `common_name` instead: require it to equal `PDF_PARSER_CLIENT_ID` and the route to be `POST /admin/facts`. Otherwise return 403.
6. Put `{actor, actor_kind}` on the request context. Handlers read the actor only from there, never from the body.

**CSRF.** Admin forms post with the Access cookie, so the Worker rejects any `POST` unless `Sec-Fetch-Site` is `same-origin` or `Origin` equals `https://{DOMAIN}`. Also set the Access application's cookie `SameSite` to `Lax` in the dashboard.

**Expiry during a write (E-13).** Access answers the POST itself with a redirect to sign-in, so the Worker never sees the request and nothing is written. The client restores its `sessionStorage` draft, which still carries its `request_id`. A resubmit after a write that did land hits `UNIQUE (request_id, venue)` and is shown as success.

**Adding and removing a curator** stays outside the app, in two places: the Access policy and the `CURATOR_EMAILS` secret. Removal also uses Access's `Revoke existing sessions`. Keep this two-step checklist in the README; it is the price of not trusting the policy alone.

**Environments.** `preview` has its own Access application and `ACCESS_AUD`. `wrangler dev` may honour `ACCESS_DEV_EMAIL` only when `ENVIRONMENT=local`. CI fails if production config sets that variable, and the smoke test asserts 403 on `/admin/overrides` without a token.

**Subscriber capability (v2).** `POST /api/push/subscribe` upserts on `endpoint`. `DELETE` and venue changes require the stored `keys.auth` to match. The Worker later POSTs to the endpoint, so the endpoint's host must be on a push-service allowlist (`fcm.googleapis.com`, `updates.push.services.mozilla.com`, `*.notify.windows.com`, `*.push.apple.com`) to prevent SSRF. A Cloudflare rate-limiting rule covers `/api/push/*`, and a row cap returns 503 once reached.

## Permissions

Permissions live in two layers: which principal may call a route, and which Worker holds which binding. D1 has no table-level grants, so the binding layer is the hard boundary and the route layer runs inside it.

**By binding.** The repo keeps its three TRD entry points, but deploys them as separate Workers so each gets only the bindings it needs.

| Worker | Routes / triggers | `DB` (core) | `PUSH_DB` | `KV` | `RAW` | Outbound |
| --- | --- | --- | --- | --- | --- | --- |
| `web` | `/`, `/history`, `/about`, `/api/status.json`, `/api/history.json`, `/feed.ics`, `/health`, 404 | — | — | Read (code never calls `put`) | — | None |
| `push` (v2) | `/api/push/*`; 1-minute drain cron | — | Read/write | — | — | Push-service allowlist only |
| `admin` | `/admin*` | Read/write | — | — | — | None; calls `ingest` and `publish` over service bindings |
| `ingest` | Hourly staggered cron | Read/write | — | Write `health:v1` | Write | Source allowlist only |
| `publish` | 30-min cron, 18:30 reconcile cron, service binding | Read/write | Write (v2 enqueue) | Write | — | Cloudflare cache-purge API |

The public Worker cannot reach D1 at all, which makes TRD decision #1 structural. A bug in `/api/push/*` can reach only subscriber rows.

**By route and principal**

| Route | Visitor | Subscriber | Curator | Service token | Writes |
| --- | --- | --- | --- | --- | --- |
| Public GET routes | Yes | Yes | Yes | Yes | Nothing |
| `POST /api/push/subscribe` (v2) | Yes (creates own row) | Yes (own row) | — | — | `push_subscription`, `push_subscription_venue` |
| `DELETE /api/push/subscribe`, `POST /api/push/test` | — | Own row, `keys.auth` must match | — | — | Delete cascade; `push_delivery` |
| `GET /admin*` | 403 | 403 | Yes | 403 | Nothing |
| `POST /admin/overrides`, `/admin/overrides/{id}/end` | 403 | 403 | Yes | 403 | `override`, `audit`, `publish_run` |
| `POST /admin/annotations`, `/admin/annotations/{id}/end` | 403 | 403 | Yes | 403 | `annotation`, `audit`, `publish_run` |
| `POST /admin/sources/{id}/mute`, `/unmute` | 403 | 403 | Yes | 403 | `source_mute`, `audit`, `publish_run` |
| `POST /admin/sources/{id}/clear-failures` | 403 | 403 | Yes, if hard-stopped | 403 | `source_state`, `audit` |
| `POST /admin/sources/{id}/fetch` | 403 | 403 | Yes, outside `min_interval_s` (E-18) | 403 | `fetch_run`, `fact`, `source_state`, `audit` |
| `POST /admin/publish` | 403 | 403 | Yes | 403 | `publish_run`, `audit` |
| `POST /admin/reconcile` | 403 | 403 | `actual` column only | 403 | `reconciliation`, `audit` |
| `POST /admin/alerts/{id}/resolve` | 403 | 403 | Yes | 403 | `alert`, `audit` |
| `POST /admin/facts` | 403 | 403 | **403** | Yes | `fetch_run` (`origin = 'external'`), `fact`, `audit` |

No route edits or deletes a fact, an audit row, a transition, a source's URL or a schema object. Those are `wrangler` commands run by the maintainer from the repo, as the TRD requires.

## Data ownership, mutability and retention

Every table has exactly one owning writer per column, and the triggers in migration 0001 make most of these rules fail loudly rather than rely on review.

| Table | Owner (sole writer) | Mutability | Retention | Personal data |
| --- | --- | --- | --- | --- |
| `venue`, `source` | The repo, via migrations | CONFIG | Permanent | None |
| `source_state` | `ingest` (`admin` may only zero `consecutive_failures`) | STATE | Permanent | None |
| `fetch_run`, `fact`, `hours_rule`, readings, `practical_info` | The source, through `ingest` or the service token | APPEND | Permanent (a few MB a year) | None |
| `override`, `annotation`, `source_mute` | The curator who created the row | SET-ONCE | Permanent | Curator email |
| `publish_run` | `publish` | Finish once | Permanent | Curator email in `triggered_by` |
| `venue_day` | `publish` | CACHE: overwritten every run | Today to today + 7; older rows pruned by `publish` | None |
| `transition` | `publish` | APPEND | Permanent; P2 shows 30 days | None |
| `reconciliation` | 18:30 job (claims) and curator (`actual`) | Column-split | Permanent | Curator email |
| `alert` | Raisers open; curator or system resolves | STATE | Permanent | Curator email |
| `audit` | `admin` | APPEND | Permanent; nothing in the app deletes it | Curator email |
| `push_subscription` and child tables | The subscribing browser | Owner may update or hard-delete | Until unsubscribed, or push service answers 404/410 | Pseudonymous endpoint only |
| `push_delivery` | `publish` queues, `push` drains | STATE | 30 days | None |
| KV snapshots | `publish` | Overwrite `current`; archives immutable | Archives 14 days | None |
| R2 raw payloads | `ingest` | Immutable | 90 days | None (public notices) |

**Ownership rules**

1. **Facts belong to their source.** No principal corrects a fact. A wrong fact is fixed by a new parse, a mute or an override, so the wrong input stays visible for the incident write-up.
2. **A curator's write is permanent and attributed.** It can be ended early once and never edited, extended or deleted. To change one, end it and create a new one (A3 `複製為新覆寫`).
3. **Derived data is disposable.** `venue_day` and every KV object can be dropped and rebuilt from inputs. The nightly job rebuilds `venue_day` at the stored `resolved_at` and raises `rebuild_mismatch` on any difference.
4. **Rebuild inputs are complete.** `resolve()` reads active facts, unexpired overrides, active mutes, the active hours rules, regulations-source freshness and the newest typhoon flag. All are append-only or set-once, so any past answer can be replayed.
5. **Split columns, split owners.** In `reconciliation` the job owns what the page claimed and the curator owns what was true. Neither can write the other's columns.
6. **Subscribers own their data outright.** Unsubscribing hard-deletes the row and cascades to venues and deliveries. Nothing about a subscriber is kept in `audit` or `tsb_core`.
7. **Curator email is the only personal data in `tsb_core`.** It is the operator's own address, kept for attribution. Neither the visitor nor the subscriber is ever identified, which keeps the TRD's 個資法 position.

## Open items before phase 3

- [ ] Apply both migrations with `wrangler d1 migrations apply --local` and on `preview`. They were tested on SQLite 3.53; confirm D1 accepts `STRICT`, generated columns, partial indexes and the `RAISE(ABORT)` triggers.
- [ ] Confirm the claim names in your Access team's tokens: `email` on identity tokens and `common_name` on service tokens.
- [ ] Measure KV propagation after an override in `preview`. Writes can take up to about 60 s to reach other edge locations, which sits right on the 60-second override promise.
- [ ] If notices never name the warm-up track separately (TRD open question), no `warmup` facts will exist and that row resolves to unknown. The schema needs no change for this.
- [ ] Verify the push-service host allowlist against current browser endpoints before turning on `FEATURE_SUBSCRIBE`.
- [ ] Review the permanent-retention tables after one year of data.

### Curator inputs

**`override`** · SET-ONCE · writer: `admin` · rank 1, the only input that can raise a day to open. `兩者` inserts two rows that share one `request_id`.

| Column | Type | Null | Key / constraint |
| --- | --- | --- | --- |
| `id` | INTEGER | No | PK |
| `request_id` | TEXT | No | `UNIQUE (request_id, venue)` blocks double submits |
| `venue` | TEXT | No | FK → `venue.id` |
| `date_from`, `date_to` | TEXT | No | to ≥ from; span ≤ 30 days; from ≥ the Taipei date of `created_at` |
| `claim` | TEXT | No | `open` · `partial` · `closed` · `unknown` |
| `window_start`, `window_end` | TEXT | Yes | Required ⇔ open or partial; start < end |
| `reason_text` | TEXT | Yes | Public; 1–60 characters; required for closed and partial |
| `source_url` | TEXT | Yes | Optional `查看來源` link |
| `note` | TEXT | Yes | Internal, never rendered; ≤ 500 |
| `created_by`, `created_at` | TEXT, epoch ms | No | Verified Access email |
| `expires_at` | epoch ms | **No** | > `created_at`, ≤ `created_at` + 31 days. Immutable |
| `ended_at`, `ended_by` | epoch ms, TEXT | Yes | Set once by `立即結束` |
| `effective_expires_at` | INTEGER | — | Generated, stored: `MIN(ended_at, expires_at)`; every "active" query uses it |

**`annotation`** · SET-ONCE · Addition (spec A2) · same columns and rules as `override` for `request_id`, `venue`, dates, `created_*`, `expires_at`, `ended_*` and `effective_expires_at`, plus `text` TEXT NOT NULL (1–60 characters). It has no claim, window or confidence, so it can never change a light.

### Resolution and publishing

**`publish_run`** · STATE (`running` → final, exactly once) · Addition · writer: `publish`

| Column | Type | Null | Key / constraint |
| --- | --- | --- | --- |
| `id` | INTEGER | No | PK |
| `trigger_kind` | TEXT | No | `cron` · `ingest` · `override` · `annotation` · `mute` · `manual` · `deploy` |
| `triggered_by` | TEXT | No | `cron`, `ingest`, `ci` or the curator email |
| `started_at`, `finished_at` | epoch ms | No, Yes | `finished_at` is NULL ⇔ `running` |
| `outcome` | TEXT | No | `running` · `ok` · `failed` · `timeout` |
| `snapshot_key`, `generated_at`, `stale` | TEXT, epoch ms, 0/1 | Yes | All required when `ok`; key matches `snapshot:v1:<ts>` |
| `purge_outcome` | TEXT | No | `not_requested` · `ok` · `failed`. A `cron` run must be `not_requested` |
| `error_code` | TEXT | Yes | Shown in E-20 |

**`venue_day`** · CACHE · writer: `publish` · `PRIMARY KEY (venue, date)`, `WITHOUT ROWID`, covers today to today + 7

| Column | Type | Null | Key / constraint |
| --- | --- | --- | --- |
| `venue`, `date` | TEXT | No | PK; `venue` FK → `venue.id` |
| `claim` | TEXT | No | All four claims |
| `window_start`, `window_end` | TEXT | Yes | Required ⇔ open or partial |
| `reason_text`, `source_url`, `source_published_on` | TEXT | Yes | Reason required when closed |
| `confidence` | TEXT | No | `human_verified` · `confirmed` · `inferred` · `unknown`; `unknown` ⇒ claim unknown |
| `decided_by_kind` | TEXT | No | `override` · `fact` · `hours_rule` · `none`; `none` ⇒ claim unknown |
| `decided_by_override_id`, `decided_by_fact_id`, `decided_by_hours_rule_id` | INTEGER | Yes | FKs; exactly the one matching `decided_by_kind` is set |
| `weather_modifier` | TEXT | No | `none` · `typhoon_unknown` · `typhoon_closed` (downgrade only) |
| `last_known_claim`, `last_known_confidence`, `last_known_at` | TEXT, TEXT, epoch ms | Yes | Only on unknown rows: `最後已知：{M/D} {state}` |
| `checked_at`, `resolved_at` | epoch ms | No | Stamp `最近查核 {HH:MM}` |
| `publish_run_id` | INTEGER | No | FK → `publish_run.id` |

**`transition`** · APPEND · writer: `publish` · one row per change in a venue-day's (claim, confidence), including its first appearance

| Column | Type | Null | Key / constraint |
| --- | --- | --- | --- |
| `id` | INTEGER | No | PK |
| `publish_run_id` | INTEGER | No | FK → `publish_run.id`; `UNIQUE (publish_run_id, venue, date)` |
| `venue`, `date` | TEXT | No | `venue` FK → `venue.id` |
| `from_claim`, `from_confidence` | TEXT | Yes | Both NULL ⇔ `cause_kind = 'first_seen'` |
| `to_claim`, `to_confidence`, `decided_by_kind` | TEXT | No | A row where nothing changed is rejected |
| `cause_kind` | TEXT | No | `first_seen` · `fact` · `override` · `override_end` · `override_expiry` · `mute` · `unmute` · `source_failure` · `staleness` · `weather` · `hours_rule` |
| `cause_text` | TEXT | Yes | The `{cause}` line, ≤ 120 |
| `fact_id`, `override_id` | INTEGER | Yes | FKs; required for fact and override causes |
| `detected_at` | epoch ms | No |  |
| `claim_changed` | INTEGER | — | Generated: from\_claim is set and differs. P2 shows only these rows |

### Correctness loop and audit

**`reconciliation`** · Addition (spec A5) · `PRIMARY KEY (venue, date)` · two writers, split by column (trigger)

| Column | Type | Null | Key / constraint |
| --- | --- | --- | --- |
| `venue`, `date` | TEXT | No | PK; `venue` FK |
| `claimed_0600`, `claimed_1800`, `decided_by_0600` | TEXT | No | Written once by the 18:30 job from `transition`; frozen after insert |
| `generated_at` | epoch ms | No |  |
| `actual` | TEXT | Yes | NULL (`—`) · `open` · `partial` · `closed` · `not_observed`; curator only |
| `filled_by`, `filled_at` | TEXT, epoch ms | Yes | Set together with `actual` |
| `result` | TEXT | — | Generated: `false_green` · `false_red` · `unconfirmed` (page showed unknown) · `match` · NULL |

**`alert`** · Addition (A1 alert cards) · writers: `ingest`, `publish`, 18:30 job raise; `admin` resolves

| Column | Type | Null | Key / constraint |
| --- | --- | --- | --- |
| `id` | INTEGER | No | PK |
| `kind` | TEXT | No | `source_degraded` · `source_hard_stop` · `parse_shape` · `claim_flip_flop` · `override_share` · `false_green` · `push_volume` · `publish_failed` · `rebuild_mismatch` |
| `severity` | TEXT | No | `amber` · `red` |
| `dedupe_key` | TEXT | No | Partial UNIQUE among open alerts, so raising twice is a no-op |
| `source_id`, `venue`, `date` | TEXT | Yes | FKs where set |
| `message` | TEXT | No | ≤ 300 |
| `opened_at`, `last_seen_at`, `emailed_at` | epoch ms | No, No, Yes |  |
| `resolved_at`, `resolved_by`, `resolution_note` | epoch ms, TEXT, TEXT | Yes | A `false_green` can only be resolved by a human email (`標示已處理`) |

**`audit`** · APPEND · writer: `admin`

| Column | Type | Null | Key / constraint |
| --- | --- | --- | --- |
| `id` | INTEGER | No | PK; keyset paging via `?before={id}` |
| `at` | epoch ms | No |  |
| `actor`, `actor_kind` | TEXT | No | `curator` ⇔ an email; `service` ⇔ `svc:<common_name>` |
| `action` | TEXT | No | `override.create/end` · `annotation.create/end` · `source.mute/unmute/clear_failures/fetch_now` · `publish.manual` · `reconcile.save` · `alert.resolve` · `facts.submit` (the only service action) |
| `entity_table`, `entity_id` | TEXT | No | One row per affected record; `venue:date` for reconciliation |
| `request_id` | TEXT | Yes | Ties the two rows of a `兩者` write together |
| `payload_json` | TEXT | No | `json_valid()` |

### Push database `tsb_push` (v2)

| Table | Columns | Keys |
| --- | --- | --- |
| `push_subscription` | `endpoint` TEXT (`https://`, ≤ 1,024), `p256dh` TEXT, `auth` TEXT, `created_at`, `updated_at`, `last_test_at`, `last_success_at` epoch ms, `consecutive_failures` INTEGER | PK `id`; UNIQUE `endpoint` |
| `push_subscription_venue` | `subscription_id` INTEGER, `venue` TEXT (`main`/`warmup`) | PK (subscription\_id, venue); FK → subscription ON DELETE CASCADE |
| `push_notified_state` | `venue`, `date`, `claim` TEXT, `publish_run_id` INTEGER, `notified_at` | PK (venue, date). Last claim notified for tomorrow |
| `push_delivery` | `kind` (`change`/`test`), `venue`, `date`, `to_claim`, `publish_run_id`, `queued_at`, `attempts` (≤ 5), `sent_at`, `http_status`, `outcome` (`queued`/`sent`/`failed`/`gone`) | PK `id`; FK → subscription CASCADE; UNIQUE (subscription\_id, kind, venue, date, publish\_run\_id) |

The push database stores no email, IP or user agent. `venue` and `publish_run_id` reference `tsb_core` by value, because D1 cannot hold a foreign key across databases.
