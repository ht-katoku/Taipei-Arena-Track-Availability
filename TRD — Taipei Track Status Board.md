# TRD — Taipei Track Status Board (臺北田徑場開放燈號)

Oct 21, 2026 · @Katoku · Companion to PRD v0.1

This is a content pipeline with a web page attached, not a web application: status is a pure function of (sources, overrides, clock), computed by a scheduled job and served as pre-rendered bytes, so the read path has no compute, no database and no JavaScript to fail.

## At a glance

&#91;embedded content: architecture · 5 pipeline stages, 3 supporting services\]

The write path runs on a schedule and may fail; the read path returns a pre-rendered object and cannot. A parser outage therefore degrades freshness — and says so on the card — rather than taking the page down or inventing a green light.

## Frontend stack

Astro 5 with TypeScript, no UI framework, no client-side router. Astro ships zero JavaScript unless a component is explicitly hydrated, which is the only way to meet "works as a static document with JavaScript disabled" without hand-writing HTML.

| Layer | Choice | Why this one |
| --- | --- | --- |
| Framework | Astro 5, TypeScript strict | Zero JS by default; islands available for the one live element; templating and type-safe content without a runtime |
| Styling | Hand-written CSS in a single file, CSS custom properties, `light-dark()` | The page has \~12 distinct elements; a utility framework adds a build step and a class vocabulary for no gain |
| Fonts | System stack only (`-apple-system`, `Noto Sans TC` fallback) | A webfont is 150–400 KB of CJK subset and a render-blocking round trip; it would cost more than the entire page |
| Icons | Inline SVG, 4 glyphs, no sprite | Each light needs one icon; a sprite request is slower than 400 bytes inline |
| Live countdown | One inline `<script>`, \~40 lines, no module | Progressive enhancement over server-rendered text (see below) |
| Build output | Static HTML + one CSS file, no JS bundle | Target: < 15 KB gzipped total, < 2 requests |

**The countdown is progressive enhancement, not a feature.** The server renders the literal sentence `開放至 22:00（還有 2 小時 40 分）`, correct at publish time. The inline script recomputes the parenthetical every 30 seconds from a `data-closes-at` attribute. With JS off, the user sees a slightly stale minute count next to an absolute time — which is why the absolute time is always rendered too, and why the countdown never carries information the absolute time does not.

**Accessibility and legibility are requirements, not polish.** Each light renders as an SVG shape + a text state + an ARIA label, so colour is never load-bearing. Minimum 4.5:1 contrast against both backgrounds, and the amber is tested at 08:00 outdoor brightness rather than on a desk monitor.

**Budget as a build gate.** CI fails the build if the rendered HTML exceeds 20 KB gzipped or if any JS bundle is emitted for the index route. A performance target that is not enforced by the pipeline degrades within three commits.

## Backend stack and runtime

Cloudflare Workers running TypeScript, one repository, three entry points. There is no application server: the only code on the read path is an edge handler that returns a cached object, and even that is bypassed for most requests by the CDN.

| Entry point | Trigger | Runtime | Responsibility |
| --- | --- | --- | --- |
| `ingest` | Cron, hourly at a staggered minute | Workers (isolate) | Conditional fetch of each enabled source, parse to facts, write to D1, enqueue a republish if facts changed |
| `publish` | Cron every 30 min, plus invoked by `ingest` and by any override write | Workers | Run the resolver for today + 7 days, render HTML and JSON, write both to KV under a versioned key |
| `admin` | HTTP, behind Cloudflare Access | Workers + Hono | Curator override CRUD, source mute/unmute, manual republish, audit list |
| `pdf-parse` (phase 3+) | GitHub Actions, scheduled | Node 22 | Any source that is only published as PDF; pushes extracted facts to `admin` over a service token |

**Why the PDF parser lives outside Workers.** Traditional-Chinese text extraction from government PDFs needs a full `pdf.js` or `pdfium` build plus CJK font handling, which exceeds the Workers bundle and CPU-time envelope and is miserable to debug in an isolate. Running it as a scheduled Node job in GitHub Actions costs nothing, has no time limit, and keeps a heavy, crash-prone dependency off the production runtime. It is a producer of facts like any other source.

**Language and libraries, deliberately few.** TypeScript in strict mode everywhere, Zod for parsing every external payload at the boundary, `linkedom` or `cheerio` for HTML selection, Hono for the eight admin routes, Vitest for tests. No ORM: the queries are a dozen hand-written statements and a query builder would obscure them. No date library beyond `Temporal`/`Intl` with a hard-coded `Asia/Taipei` zone, because every date in this system is a Taipei calendar day and a UTC-shifted day boundary is the most likely source of a wrong answer at 06:00.

**Idempotence is the operating rule.** `ingest` and `publish` must be safe to run twice; every write is keyed by `(source_id, fetched_at)` or `(venue, date)` so a retried cron, a double-fired trigger or a manual rerun converges on the same state rather than appending duplicates.

## Data model and storage

Cloudflare D1 (SQLite) as the system of record, Workers KV as the read-path cache, R2 for raw payload archive. Total data after a year is roughly 730 venue-days plus 9,000 fetch rows — a few megabytes. Postgres would be operational overhead buying nothing.

| Store | Holds | Access pattern | Why |
| --- | --- | --- | --- |
| **D1 (SQLite)** | Sources, fetch runs, facts, overrides, resolved status, transitions, audit | Single writer (cron), read only by `publish` and `admin` | Relational queries over tiny data; migrations in the repo; SQLite semantics are predictable under a single writer |
| **Workers KV** | The rendered HTML document and `status.json`, under `snapshot:v1:current` | Read on every request, written a few times a day | Eventually-consistent global reads in single-digit ms; the read path never touches D1, so a DB incident cannot take the page down |
| **R2** | Raw fetched bytes, keyed by `sha256`, 90-day lifecycle | Written by `ingest`, read only during incident forensics | Lets any wrong answer be replayed against the exact bytes that produced it, without bloating D1 |

**Core tables.** Facts are append-only and never updated; the resolved status is derived and may be recomputed from scratch at any time. That split is what makes the pipeline auditable.

```markdown
source(id, name, kind, url, enabled, robots_ok, min_interval_s, muted_until, last_etag, last_modified, consecutive_failures)
fetch_run(id, source_id, started_at, http_status, bytes, content_hash → r2_key, outcome, error)
fact(id, fetch_run_id, source_id, venue, date, claim, window_start, window_end, reason_text, source_url, confidence, extracted_at)
override(id, venue, date_from, date_to, claim, reason_text, created_by, created_at, expires_at NOT NULL, note)
venue_day(venue, date, claim, window_start, window_end, reason_text, confidence, decided_by_fact_id, resolved_at)  -- PK (venue, date)
transition(id, venue, date, from_claim, to_claim, cause, detected_at, fact_id)
audit(id, actor, action, payload_json, at)
```

**Three rules that carry most of the integrity.**

1. `venue_day` is a cache of the resolver, not an input to it. Dropping the whole table and rebuilding from `fact` + `override` must produce identical rows; a scheduled job asserts this nightly.
2. `override.expires_at` is `NOT NULL` at the schema level. A permanent manual override is how this product quietly becomes a hand-maintained page that nobody maintains.
3. Absence of a row is a meaningful state. No `venue_day` row means `狀態未確認`, rendered as a first-class state — never defaulted to open, and never an error page.

**Timezone handling.** Every `date` column is a Taipei calendar date stored as `TEXT` in `YYYY-MM-DD`; every timestamp is UTC epoch milliseconds. Conversion happens in exactly one module. The 06:00 answer is the product, and 06:00 Taipei is 22:00 the previous UTC day, so no date arithmetic is allowed to touch a UTC day boundary.

## Status resolution engine

One pure function, no I/O, no clock of its own:

```markdown
resolve(facts: Fact[], overrides: Override[], venue: Venue, date: TaipeiDate, now: Instant) → VenueDay
```

Everything else in the system exists to feed it or to display its output. Because it is pure, the entire correctness argument of the product is a table of fixtures and expected outputs, runnable in milliseconds.

**Precedence, highest first.** The first source that speaks for the `(venue, date)` wins outright; later sources are not consulted and never average in.

| Rank | Input | Confidence produced | Notes |
| --- | --- | --- | --- |
| 1 | Unexpired curator override | `human_verified` | Only input that can raise a status to open |
| 2 | Official venue notice covering that date | `confirmed` | Parsed from the operator's own listing |
| 3 | Competition or booking schedule implying closure | `inferred` | Card reads "check before travelling" |
| 4 | Published regular hours (08:00–22:00) | `confirmed`, open | Only applies when no higher rank speaks and the source was fetched successfully within 48h |
| — | Nothing speaks, or the covering source failed | `unknown` | Grey state, last known shown as history only |

**Weather is a modifier, never a source.** A typhoon day signal from the CWA can downgrade `open → unknown` or `open → closed` where the operator has published a weather rule, but no weather condition can upgrade anything. It is applied after resolution, as a separate function with the same purity property.

**Fail-closed is enforced by the type system, not by discipline.** The resolver returns a discriminated union in which `unknown` is a legal, renderable value; there is no nullable claim and no `boolean isOpen`. A parser that cannot produce a well-formed `Fact` produces none, and a venue-day with no facts resolves to `unknown`. The only path to a green light is a positively parsed, in-date, high-rank fact.

```markdown
type Claim = "open" | "partial" | "closed" | "unknown"
type VenueDay =
  | { claim: "open" | "partial"; window: [HHMM, HHMM]; reason?: string; confidence: Confidence; source: Url }
  | { claim: "closed"; reason: string; confidence: Confidence; source: Url }   // a red always states why
  | { claim: "unknown"; lastKnown?: VenueDay; checkedAt: Instant }
```

**Tests are golden fixtures, not mocks.** Every real source payload ever fetched is available in R2 by hash; the suite pins a few dozen of them — a meet weekend, a typhoon day, a malformed page, a page that changed shape — as inputs with asserted outputs. A resolver change that flips any fixture fails CI. This is the highest-value test surface in the project and should be written before the scraper.

## Authentication and access control

No authentication code is written for this project. The visitor has no identity and the curator's identity is delegated to Cloudflare Access, because hand-rolled auth is the highest-risk code a solo maintainer can own and it answers none of the product's questions.

| Principal | Mechanism | Scope | Session |
| --- | --- | --- | --- |
| **Visitor** | None. No cookies, no local storage, no analytics identifier | Read `/`, `/api/status.json`, `/history` | — |
| **Curator** | Cloudflare Access policy allowing one Google identity, in front of `/admin/*` | Override, mute source, republish, read audit | Access JWT, 8h, revocable from the dashboard |
| **Ingestion cron** | None needed — invoked by the Workers runtime, not over HTTP | D1 and R2 bindings, outbound fetch | — |
| **External parser job** | Service token (Access `CF-Access-Client-Id` / `-Secret`), stored as a GitHub Actions secret | `POST /admin/facts` only | Per-request |
| **Subscriber (v2)** | Opaque push endpoint or unguessable iCal URL | Receive notifications | No account, ever |

**Zero cookies is a product decision with a technical payoff.** No cookie means no consent banner, which the PRD forbids; it also means the HTML is identical for every visitor, which is what allows the whole page to be a single cacheable object at the edge. Analytics, if ever added, must be request-log-based or a cookieless aggregate — anything that sets state on the device reopens the banner question.

**The admin surface is deliberately crippled.** It can write overrides, mute a source and trigger a republish. It cannot edit facts, delete audit rows, change schema or deploy. Anything destructive is a `wrangler` command run from the maintainer's machine with the repo in front of them.

**Every admin write is attributed and expiring.** The Access JWT's email is written to `audit.actor`; an override without `expires_at` is rejected at the API boundary as well as by the schema.

## APIs

### Consumed

No availability API exists, so three of the five inputs are HTML scrapes and must be treated as hostile, unversioned contracts. Exact endpoints and dataset identifiers are listed as open questions below; the table fixes the policy, not the URLs.

| Source | Type | Cadence | Yields | Failure mode |
| --- | --- | --- | --- | --- |
| Venue notice listing (臺北體育園區) | HTML scrape | 1×/hour, conditional | Rank-2 facts: closures, maintenance, weather notices | → `unknown` for covered dates |
| Competition calendar (中華民國田徑協會 and city meets) | HTML scrape, PDF for detail | 1×/day | Rank-3 facts: meets weeks ahead, the main source of lead time | → keep prior facts, alert |
| Venue open data (data.gov.tw) | JSON/CSV | 1×/week | Static practical strip: address, fees, hours, entrances | → serve last cached |
| CWA open data | REST + API key | 1×/hour | Temperature, humidity, rain probability, typhoon day flag | → hide conditions block, status unaffected |
| MOENV air quality | REST + API key | 1×/hour | AQI at the nearest station | → hide the AQI chip only |

**Polling contract, enforced in one shared fetch wrapper.** No source is fetched by any other code path.

- `If-None-Match` and `If-Modified-Since` on every request; a 304 costs one row in `fetch_run` and nothing else.
- One request per source per hour maximum, with the cron minute staggered per source so requests never burst.
- `User-Agent: TaipeiTrackStatus/1.0 (+https://<domain>/about; contact@<domain>)` — identifiable and reachable, so the operator can ask rather than block.
- 10s timeout, 2 MB response cap, exponential backoff on non-200, hard stop and alert after three consecutive failures.
- `robots.txt` honoured per source and re-checked weekly; a disallow disables the source rather than being worked around.
- Store extracted fields and link out. Nothing is mirrored except the hashed raw payload in private R2, which is never served.

### Published

| Endpoint | Returns | Cache | Notes |
| --- | --- | --- | --- |
| `GET /` | Pre-rendered HTML | `s-maxage=300, stale-while-revalidate=3600` | The product |
| `GET /api/status.json` | Current snapshot, schema below | Same | `Access-Control-Allow-Origin: *`; stable contract, versioned path when it breaks |
| `GET /api/history.json?days=30` | Transitions with sources | 1 hour | Powers the change log; also the audit trail readers can check |
| `GET /feed.ics` (v2) | Closed days as all-day events | 1 hour | Coaches subscribe once |
| `GET /health` | Last successful fetch per source, staleness age | No cache | Public on purpose: the failure state is not a secret |

```markdown
{
  "generated_at": "2026-10-21T06:00:00+08:00",
  "stale": false,
  "venues": [
    { "id": "main", "name": "臺北田徑場主場", "claim": "closed",
      "reason": "全國田徑公開賽 1/31–2/4", "confidence": "confirmed",
      "source_url": "https://…", "source_published": "2026-10-14" },
    { "id": "warmup", "name": "暖身場", "claim": "open",
      "window": ["08:00", "22:00"], "confidence": "human_verified",
      "verified_at": "2026-10-21T06:10:00+08:00" }
  ],
  "outlook": [ { "date": "2026-10-22", "main": "unknown", "warmup": "open" } ],
  "conditions": { "temp_c": 24.1, "rain_prob": 0.2, "aqi": 48, "as_of": "05:40" }
}
```

The JSON is the real interface. The HTML page is one renderer of it, the iCal feed will be another, and publishing it openly is also the cheapest form of accountability: anyone can diff yesterday's snapshot against what the gate actually did.

## Deployment and environments

GitHub as the only control plane: push to `main` deploys, and nothing is ever changed by hand in a dashboard except the Access policy and the secrets.

| Environment | Trigger | Data | Purpose |
| --- | --- | --- | --- |
| `preview` | Every pull request | Separate D1 + KV, seeded from fixtures | Parser changes verified against saved payloads; no outbound fetching to real sources |
| `production` | Push to `main` | Live D1, KV, R2 | The site |
| local | `wrangler dev` | Local D1 (`--local`), fixture payloads | Day-to-day work; the shared fetch wrapper refuses to call real hosts unless a flag is set |

**Pipeline on push.** Typecheck → unit tests including the resolver fixtures → build Astro → assert the budget (no JS bundle, < 20 KB gzipped) → `wrangler d1 migrations apply` → deploy Workers → smoke test `/health` and `/api/status.json` against the schema → republish snapshot. Any step failing leaves the previous Worker version and the previous KV snapshot serving, which is the whole point of separating publish from deploy.

**Rollback is two independent levers.** `wrangler rollback` restores the previous Worker version; separately, every snapshot is written to `snapshot:v1:<timestamp>` with a pointer at `snapshot:v1:current`, so a bad render can be reverted by moving the pointer, in seconds, without a deploy. Snapshots are retained 14 days.

**Migrations are forward-only and additive.** SQLite in D1 makes column drops awkward; a column stops being written before it stops existing. Every migration is a numbered file in the repo and runs in CI, never from a laptop.

**Secrets** live in Workers secrets (CWA key, MOENV key, Access service token) and GitHub Actions secrets for the external parser. None are in `wrangler.toml`, which is committed. Key rotation is a 15-minute job documented in the repo README, because the maintainer will have forgotten by the time it matters.

**Cost envelope.** Cloudflare free tier covers this workload with a wide margin (the page is a handful of KV reads per visit; crons are \~50 invocations a day). Expected running cost is the domain registration, roughly NT$400–800/year, plus NT$0–150/month if Workers Paid is ever needed for D1 size or Access seats. A side project that costs money monthly gets cancelled in a budget review of one.

## Security requirements

The attack surface is unusually small — no user input, no accounts, no PII — so the real risks are a hostile input turning into a wrong answer, and the one authenticated surface being left open.

| Requirement | Implementation | Verified by |
| --- | --- | --- |
| No untrusted input reaches a renderer | All source data passes a Zod schema at the boundary; rendering escapes by default and never uses `innerHTML` or `set:html` | Lint rule banning raw HTML injection; parser fixtures include a payload with embedded markup |
| Parsers cannot hang or exhaust the runtime | 10s fetch timeout, 2 MB cap, no unbounded regex backtracking, PDF work isolated to the external job | Load test with a 50 MB response and a pathological document |
| Admin surface is never reachable unauthenticated | Cloudflare Access on `/admin/*` at the edge, plus JWT verification inside the Worker — defence in depth, since an Access misconfiguration is a single dashboard click | CI smoke test asserts 403 on `/admin/overrides` without a token |
| No SSRF via source configuration | Source URLs come from a committed allowlist in the repo, not from the database or the admin API | Code review; the fetch wrapper rejects any host not on the list |
| Headers | `Content-Security-Policy: default-src 'none'; style-src 'self'; script-src 'self'; img-src 'self' data:`, HSTS, `X-Content-Type-Options: nosniff`, `Referrer-Policy: no-referrer` | Automated header check in the deploy smoke test |
| No third-party code on the page | No analytics, tag manager, font CDN, or embed | The CSP above makes this structural rather than a promise |
| Dependencies stay small and pinned | Lockfile committed, Dependabot weekly, every direct dependency justified in the README | Dependency count target: under 15 direct |
| Secrets never in the repo or logs | Workers secrets only; the fetch logger redacts query strings containing `apikey` | Secret scanning on push |

**Legal and reputational safety is a security property here.** The site republishes nothing: it stores extracted fields and links to the original notice, carries a persistent `非官方資訊，出發前請再確認` line with a source link on every status, and names a contact address. The politeness controls in the polling contract are the practical defence against being blocked, which for this product is equivalent to being taken offline.

**No personal data, by construction.** No accounts, no cookies, no IP logging beyond Cloudflare's own edge logs at default retention. This keeps the project outside 個資法 obligations entirely. The v2 notification feature is the first thing that would change that, and it should store a push endpoint with no identifier attached and nothing else.

## Observability and correctness audit

Uptime is not the metric; being right is. The system therefore instruments its own accuracy, not just its availability, and a false green is handled as an incident rather than a bug.

**The daily reconciliation loop.** Each evening a job writes a row per venue-day containing what the page claimed at 06:00 and 18:00, with a blank column for what was actually true. The curator fills the blank from observation or a club report; two minutes a day. That column is the only honest measure of the PRD's 98% accuracy target, and without it the metric is unmeasurable. After 14 clean days, phase 5 is done.

| Signal | Threshold | Response |
| --- | --- | --- |
| Parse shape assertion fails | Any occurrence | Affected venue-days → `unknown`, alert to the curator |
| Consecutive fetch failures | 2 | Source marked degraded, alert; at 3, source muted until cleared by hand |
| No successful fetch, any source | 48 h | Page renders the stale banner automatically |
| Claim flips more than twice in a day | Any occurrence | Alert — almost always a parser oscillating, not reality |
| Override share of published statuses | > 30% over 14 days | Automation has failed; stop adding features and fix the parser |
| Reconciliation mismatch, false green | 1 | Incident: write-up in the repo, fixture added, resolver or source rank changed |

**The dead-man's switch is inside the render, not in a monitor.** The published snapshot carries `generated_at`; the page computes staleness against the viewer's clock and degrades itself. A banner that depends on a separate monitoring service staying alive has two ways to fail silently instead of one.

**Alerting is email to one person, nothing more.** No PagerDuty, no on-call, no dashboard that needs logging in. Workers Logpush to a free sink for the fetch log, and a weekly digest with the reconciliation table, the override count and the unknown rate. The weekly digest is also the dead-man's switch for the maintainer: when it stops arriving in the inbox, the project has quietly stopped working.

## Build sequence

&#91;embedded content: build sequence · 5 phases, each with its gate\]

The sequencing is the main technical risk control in the plan. Phase 1 ships the renderer, the state vocabulary and the copy against hand-entered data, so that when the first parser lands in phase 3 there is already a known-correct answer to diff it against — which is the only cheap way to catch a parser that is confidently wrong rather than loudly broken.

## Technical decisions and rejected alternatives

Every decision below is defended against the same two constraints: one maintainer with two weekends, and a product whose only promise is correctness.

| # | Decision | Reason | Rejected |
| --- | --- | --- | --- |
| 1 | Pre-render to KV; no compute on the read path | The read path cannot be wrong or slow if it does nothing but return bytes; a DB or parser incident degrades freshness, never availability | Server-side rendering per request (couples the page's uptime to D1 and to parser health) |
| 2 | Astro, zero JS by default | "Works with JS disabled" and 1.5s FMP are stated requirements; opt-in hydration makes them the default outcome rather than a thing to defend | Next.js or SvelteKit (React/Svelte runtime for a page with one dynamic number); raw HTML (no types, no components, worse to maintain) |
| 3 | Cloudflare Workers + Pages + D1 + KV + R2 | One vendor covers static hosting, cron, SQL, cache and object store on a free tier, with an edge PoP in Taipei; fewer integration seams than any mixed stack | Vercel + Neon + GitHub Actions cron (three dashboards, three failure modes); a VPS (patching, backups, uptime — permanent work) |
| 4 | SQLite/D1, not Postgres | \~3,000 rows a year, single writer, no concurrency; the read path never queries it | Postgres or Supabase (operational weight and a connection model this workload never needs) |
| 5 | Append-only facts, derived status | Any answer can be replayed and explained from its inputs; the status table can be rebuilt from zero | Mutating a status row in place (destroys the audit trail exactly when a wrong green needs explaining) |
| 6 | `unknown` as a first-class state in the type system | Makes fail-closed structural; there is no code path from a parser error to a green light | A nullable boolean or an error page (both invite a default, and the default is always "open") |
| 7 | Resolution by source precedence, not consensus | A single rule a tired maintainer can hold in their head at 06:00; no weighting to tune | Scoring or voting across sources (one confident wrong parser outvotes two silent ones) |
| 8 | Cloudflare Access for the curator; no auth code | Auth is the highest-risk code in a solo project and it answers none of the product's questions | Rolling sessions and password hashing; a shared secret in a query string |
| 9 | PDF parsing in GitHub Actions, not Workers | CJK extraction needs a heavy runtime and real debugging; keeping it off the production isolate contains the blast radius | `pdf.js` inside a Worker (bundle size, CPU limits, opaque failures) |
| 10 | Manual JSON file first, scraping third | Proves the copy, the states and the resolver against reality before any parser exists, and is already useful on day one | Building the scraper first (the usual order, and the usual reason these projects ship nothing) |
| 11 | Publish `status.json` openly from v1 | The HTML is one renderer among several; an open snapshot makes the site's accuracy checkable by anyone | HTML-only (locks the iCal feed and any future client out, and hides the record) |
| 12 | Hourly conditional polling, hard-capped | The underlying notices move a few times a week; the only real risk is being read as abusive and blocked | Minute-level polling for a real-time feel (buys nothing, risks everything) |

## Open technical questions

These are the unknowns that could change the architecture rather than the implementation. All of them are answered by phase 2 instrumentation, which is why phase 2 exists.

- [ ] **Which page actually announces closures first, and in what form?** The whole ingestion design assumes an HTML listing exists. If closures appear only inside PDFs or only on Facebook, rank 2 collapses into rank 3 and the override becomes the primary mechanism, which changes the product's honest confidence ceiling.
- [ ] **Do the main track and the warm-up track ever get announced separately?** If notices only ever name the stadium as a whole, the dual light is unsupportable from parsed data and venue 2 must be marked `unknown` until a human says otherwise — a significant honesty cost to the PRD's second user story.
- [ ] **`robots.txt` and terms on each source host.** A disallow on the notice listing disables that source rather than being routed around. Check before writing the parser, not after.
- [ ] **Exact CWA and MOENV dataset identifiers, and whether their free API keys permit this use.** The conditions block is P1 and can ship later; confirm before building against it.
- [ ] **How far ahead competitions are actually published.** The PRD targets a median 24h of lead time; if the calendar runs weeks ahead, the outlook strip is nearly free, and if it runs days ahead, the 7-day strip is mostly `unknown` and should be shortened to 3 days.
- [ ] **Whether the 2024 smart-venue system exposes anything machine-readable.** If it does, it outranks everything as a rank-1.5 source. One email to the operator is cheaper than a month of scraping, and asking also pre-empts the "operator objects" risk.
- [ ] **Stadium coordinates and which AQI station is nearest.** Trivial, but it should be a constant in the repo with a comment, not a magic number.

## Sources

This document is a technical design derived from PRD v0.1 and contains no new external research. The venue hours and open-data references it relies on are the ones cited in the PRD: the [臺北體育園區 management regulations](https://laws.gov.taipei/law/File/0000181221) and the [city venue dataset on data.gov.tw](https://data.gov.tw/dataset/137770). Endpoint-level facts marked open above are unverified and should be confirmed before phase 3.
