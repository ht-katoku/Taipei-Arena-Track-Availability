# Decisions

Rulings where the specs disagree or are silent. When a spec is silent, the
option that fails closed (`unknown`, never `open`) is chosen and logged here.

## Settled in the Implementation Plan (Nov 7, 2026)

| #   | Topic                                                        | Ruling                                                                                                               |
| --- | ------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------- |
| 1   | KV layout: TRD pointer key vs Schema direct objects          | Write `snapshot:v1:current:<name>` directly, plus timestamped copies for rollback                                    |
| 2   | Ending an override                                           | Set `ended_at` once; `expires_at` never changes                                                                      |
| 3   | `source.muted_until` column                                  | Append-only `source_mute` table                                                                                      |
| 4   | One Worker vs separate Workers                               | Separate `web`, `admin`, `ingest`, `publish` Workers (`push` in v2), one repo, shared `src/`                         |
| 5   | Astro vs runtime rendering                                   | UI components written once in Hono JSX (pending D-1)                                                                 |
| 6   | CSP `script-src 'self'` blocks the P1 inline script          | Add that script's `sha256-` hash to `script-src` at build time                                                       |
| 7   | `s-maxage=300` vs the 60-second override promise             | Purge `/`, `/history`, `/api/*` on every non-cron publish; measure KV propagation at the Phase 5 gate                |
| 8   | Migration SQL and 111 constraint tests are not in the folder | Regenerate both from the Schema's table reference in Phase 3                                                         |
| 9   | Per-source `cron_minute` needs a cron finer than hourly      | `ingest` cron runs every 5 min; fetch only sources whose minute bucket matches and whose `min_interval_s` has passed |
| 10  | Cron triggers run in UTC                                     | 18:30 Taipei = `30 10 * * *`; every schedule carries a Taipei-time comment                                           |
| 11  | No schema support for logging sources without publishing     | `mode: 'shadow' \| 'live'` per source in `src/shared/sources.ts`                                                     |
| 12  | Rank 4 needs the regulations source fetched within 48 h      | Build the fetch wrapper and the regulations adapter first in Phase 6                                                 |

## Open decisions for Katoku

| #   | Decision                                                                                                              | Recommendation                                                                                          | Needed by     | Status                                                                                  |
| --- | --------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- | ------------- | --------------------------------------------------------------------------------------- |
| D-1 | Hono JSX everywhere, or keep Astro for static pages                                                                   | Hono JSX everywhere                                                                                     | Phase 4       | Open                                                                                    |
| D-2 | Admin scope at launch                                                                                                 | A1, A2, A3, A5 for launch; A4 and A6 after M2                                                           | Phase 5       | Open                                                                                    |
| D-3 | Warm-up track when notices never name it separately                                                                   | Render `狀態未確認` unless an override speaks                                                           | After Phase 1 | Settled 2026-11-15: 暖身場 has its own monthly table, so it resolves from its own facts |
| D-4 | PRD metrics that need analytics                                                                                       | Qualitative bar plus publish-side freshness                                                             | Phase 9       | Open                                                                                    |
| D-5 | Access login method                                                                                                   | Google; one-time PIN as the simpler fallback                                                            | Phase 2       | Open                                                                                    |
| D-6 | English venue names                                                                                                   | Operator's official names if they exist                                                                 | Phase 9       | Open                                                                                    |
| D-7 | Outlook length                                                                                                        | 7 days if meets are published weeks ahead, else 3                                                       | Phase 6       | Open                                                                                    |
| D-8 | Open windows per venue-day: one window (specs) or a list. The operator's table gives 主場 two windows on a normal day | A list of windows everywhere (type, schema, `status.json`, phase copy, A2 form)                         | Phase 3       | Decided 2026-11-15 by Katoku: a list of windows. Design in L-7                          |
| D-9 | How a normal 主場 day reads (open 05:00–09:00 and 18:00–22:00, shut in between)                                       | `開放` with two windows, because it is the regular schedule; `部分開放` only when an event cuts into it | Phase 4       | Open                                                                                    |

## Logged during the build

| #   | Date       | Phase | Decision                                                                                                                                                                         |
| --- | ---------- | ----- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| L-1 | 2026-11-15 | 1     | `@cloudflare/vitest-pool-workers`, Hono and Zod are not installed in Phase 1. Each is added in the phase that first uses it (Phase 3, 2, 4), so no unused dependency is carried. |
| L-2 | 2026-11-15 | 1     | The closed light reads `未開放` (App Flow Spec), not the PRD's `不開放`. The App Flow Spec is the authority for copy.                                                            |
| L-3 | 2026-11-15 | 1     | The `admin` Worker stub returns 403 for every request until the Access middleware exists in Phase 2.                                                                             |
| L-4 | 2026-11-15 | 1     | The six spec documents stay in the repo root under their original names and are excluded from Prettier.                                                                          |
| L-5 | 2026-11-15 | 1     | Local development runs on Node 26 LTS (what winget installs today); CI stays on Node 22 as the plan specifies. `engines` allows both. Revisit if the two ever disagree.          |
| L-6 | 2026-11-15 | 1     | Wrangler telemetry is switched off (`send_metrics: false`) in every Worker config, so the toolchain sends nothing about this project to a third party.                           |
| L-7 | 2026-11-15 | 1     | Windows-list design (D-8), overriding the single `window_start`/`window_end` in the TRD, App Flow Spec and Backend Schema. See "L-7 detail" below.                               |

### L-7 detail: a list of open windows per venue-day

- **Type.** `windows: [HHMM, HHMM][]` replaces `window: [HHMM, HHMM]` on `open` and `partial`. One to four entries, each start before end, sorted, not overlapping or touching. An `open` or `partial` value with an empty or malformed list is not a legal `VenueDay`; a parser that cannot produce one produces no fact, so the day resolves to `unknown`.
- **Schema.** In `fact`, `override` and `venue_day`, the columns `window_start` and `window_end` become one `windows_json TEXT` column: required when the claim is open or partial, NULL otherwise, with a `json_valid` CHECK. Ordering and overlap are checked by the shared Zod schema at every write, with tests. `hours_rule` keeps one window per row; a venue with two regular windows has two rows.
- **`status.json`.** `"windows": [["05:00","09:00"],["18:00","22:00"]]` replaces `"window"`.
- **Window line.** The phase table runs over the list: before the first window or between two windows it reads `今日 {next_start} 開放（還有 {duration}）`; inside a window it reads `開放至 {end}（還有 {duration}）`; after the last window it reads the "ended" copy with the last end time. Each venue row carries the list in one `data-windows` attribute in place of `data-opens-at` and `data-closes-at`.
- **A2 form.** `開放時段` becomes one to three start/end pairs with an `新增時段` control. The defaults are the venue's regular hours.
- **Most restrictive wins** (Schema decision 6) is unchanged: closed beats partial beats open. Two same-rank facts with the same claim and different windows resolve to the intersection of their windows; an empty intersection resolves to closed.
