# Taipei Track Status Board — App Flow Spec

Oct 24, 2026 · @Katoku

## Scope and product decisions

This spec covers every screen, action and state of the Taipei Track Status Board v1, plus the v2 subscription flow behind a feature flag. It sits on top of PRD v0.1 (Oct 16) and the TRD (Oct 21) in the project folder. Anything this spec adds that the TRD lacks is marked **Addition**. Anything that resolves a conflict between the two is marked **Resolution**.

| Question | Decision | Why |
| --- | --- | --- |
| Visitor login / signup | **None.** No accounts, cookies, local storage or analytics ID on public pages | The PRD forbids a login wall. Zero cookies means no consent banner, and one cacheable HTML object for everyone |
| Curator login | Cloudflare Access with one Google identity. The app has no signup or password screens | TRD decision #8: hand-rolled auth is the riskiest code a solo maintainer can own |
| Payment / upgrade | **Not built.** No paywall, tiers, ads or in-app donation | The PRD rules out monetisation. Running cost is about NT$400–800 a year |
| Change subscription | v2, behind `FEATURE_SUBSCRIBE=false`. Web push + iCal, no account | PRD feature 9 is "not in v1". It is specified here so v2 needs no new design pass |
| On-site confirmation | Not built, and no placeholder UI | PRD feature 10, deferred |
| Language | zh-TW primary, with small English secondary labels. No language toggle, no `/en` route | PRD: "a thin English layer" |

**Build rules the coding agent must follow on every screen**

- Public pages are Astro static output with no JS bundle. The one exception is a single inline script on `/` (spec in the Home screen section). **Resolution:** the TRD's CSP `script-src 'self'` would block an inline script, so the build adds that script's `sha256-…` hash to `script-src`.
- Design baseline is a 360 × 640 px viewport. Tap targets are at least 44 × 44 px. Body text is at least 16 px.
- All dates and times are Asia/Taipei. Dates are `M/D（週）`, e.g. `10/24（六）`. Times are 24-hour `HH:MM`.
- Durations: `2 小時 40 分`. Under one hour: `40 分`. Under one minute: `不到 1 分鐘`.
- Every quoted UI string in this spec is canonical copy. Keep them all in one `src/copy.ts` file, keyed by the IDs used here.
- External links open in a new tab with `rel="noopener noreferrer"`. Internal links open in the same tab.

## Sitemap and routes

The app has 5 public screens and 6 admin screens. No public page links to `/admin`: the curator reaches it from a bookmark.

&#91;embedded content: sitemap · 5 public screens, 7 admin steps\]

Home is the hub of the public side. Every admin screen checks the Access token again inside the Worker, and `/subscribe` returns 404 until its flag is on.

| ID | Route | Screen | Auth | Rendering | JS |
| --- | --- | --- | --- | --- | --- |
| P1 | `/` | 今日燈號 (Home) | None | Pre-rendered to KV by `publish` | One inline script, about 40 lines |
| P2 | `/history` | 變動紀錄 (Change log) | None | Pre-rendered by `publish` | None |
| P3 | `/about` | 關於本站 (About) | None | Static at build time | None |
| P4 | `/subscribe` | 通知訂閱 (v2) | None | Static at build; returns 404 while the flag is off | Required (push API) |
| P5 | any unknown path | 404 找不到頁面 | None | Static | None |
| P6 | `/` when no snapshot exists | 503 備援頁 | None | Inlined in the Worker | None |
| A0 | Cloudflare-hosted | Access sign-in | — | Cloudflare, not built by us | — |
| A1 | `/admin` | 總覽 (Dashboard) | Access + JWT check | Hono SSR per request | Small, optional |
| A2 | `/admin/overrides/new` | 新增覆寫 / 註記 | Access + JWT | Hono SSR | Live preview and draft save |
| A3 | `/admin/overrides` | 覆寫列表 | Access + JWT | Hono SSR | None |
| A4 | `/admin/sources` | 資料來源 | Access + JWT | Hono SSR | None |
| A5 | `/admin/reconcile` | 對帳 | Access + JWT | Hono SSR | None |
| A6 | `/admin/audit` | 稽核紀錄 | Access + JWT | Hono SSR | None |

These are data routes, not screens, but the UI depends on them: `GET /api/status.json`, `GET /api/history.json?days=30`, `GET /health`, `GET /feed.ics` (v2), and `POST`/`DELETE /api/push/subscribe` (v2). Shapes are as in the TRD.

## Global state model and shared components

Every screen renders from the same three inputs: the venue **claim**, its **confidence**, and the time **phase** computed from the clock. Colour never carries meaning alone. Every light is an icon, a text state and an `aria-label`.

**Claim → light**

| Claim | zh label | en label | Colour token | Icon (inline SVG) | `aria-label` |
| --- | --- | --- | --- | --- | --- |
| `open` | 開放 | Open | `--status-open` (green) | Check in a circle | `主場：開放` |
| `partial` | 部分開放 | Partly open | `--status-partial` (amber) | Half-filled circle | `主場：部分開放` |
| `closed` | 未開放 | Closed | `--status-closed` (red) | Cross in a circle | `主場：未開放` |
| `unknown` | 狀態未確認 | Unconfirmed | `--status-unknown` (grey) | Question mark in a circle | `主場：狀態未確認` |

Swap `主場` for `暖身場` on the warm-up row. All four colours must reach 4.5:1 contrast against the background in light and dark mode.

**Confidence → stamp line** (shown under each light)

| Confidence | Stamp copy | Link |
| --- | --- | --- |
| `human_verified` | `人工確認 · {M/D} {HH:MM}` | `查看來源` → `source_url`, if any |
| `confirmed` (notice) | `依場館公告 · {source_published M/D}` | `查看公告` → `source_url` |
| `confirmed` (regular hours, rank 4) | `依公告開放時間 · 最近查核 {HH:MM}` | `查看規定` → the regulations URL |
| `inferred` | `由賽程推估 · 出發前請再確認` | `查看賽程` → `source_url` |
| `unknown` | `最近查核 {HH:MM}` | `查看官方公告` → the venue notice listing |

**Phase → window line** (only for `open` and `partial`). `now` is Taipei time. `start` and `end` are today's window.

| Condition | Window line copy |
| --- | --- |
| `now < start` | `今日 {start} 開放（還有 {duration}）` |
| `start ≤ now < end` | `開放至 {end}（還有 {duration}）` |
| `now ≥ end`, tomorrow is `open` or `partial` | `今日開放已結束（{end}）· 明日 {tomorrow_start} 開放` |
| `now ≥ end`, tomorrow is anything else | `今日開放已結束（{end}）· 明日{tomorrow_label}` |
| `closed`, tomorrow is `open` | `今日不開放 · 明日 {tomorrow_start} 開放` |
| `closed`, tomorrow is anything else | `今日不開放` |
| `unknown` | `目前沒有資料涵蓋今日` |

The light always shows **today's claim**. After closing time it stays the same colour, and the window line says the day is over. This keeps the static render correct between publishes. Each venue row carries `data-opens-at` and `data-closes-at` in epoch ms, so the script can recompute the line.

**Freshness rules** (computed from `generated_at` in the snapshot)

| Snapshot age or flag | Page behaviour | Copy ID |
| --- | --- | --- |
| Up to 2 h | Normal | — |
| Over 2 h, JS on | Amber banner under the header | E-02 |
| `stale: true`, or over 48 h | Red banner. Both lights forced to `unknown`, last known shown as history | E-03 |
| Taipei date now ≠ snapshot date | Reload once with `?r={epoch_minute}`. If still wrong, banner | E-04 |

**Shared components** (built once, used on P1–P5)

- **SiteHeader:** `臺北田徑場開放燈號` with a small `Taipei Track Status` line. On P1 it also shows the date label `{M/D（週）}` and `頁面更新 {HH:MM} · 重新整理`. `重新整理` is a plain `<a href="/">`. On P2–P5 the title links to `/`.
- **StaleBanner:** a full-width bar under the header with icon, copy and a `重新整理` link. Hidden by default. Has `role="status"`.
- **DisclaimerLine:** `非官方資訊，出發前請再確認。` plus a link `官方公告` to the venue notice listing. It appears on P1 and P2 and is never dismissible.
- **SiteFooter:** `關於本站` → `/about` · `資料 API` → `/api/status.json` · `系統狀態` → `/health` · `聯絡我們` → `mailto:{CONTACT_EMAIL}`. Below it: `本站為個人專案，與臺北市政府體育局無關。`

## Public screens

### P1 · Home `/`

Home is one scroll with no menu. Elements 1–4 must fit above the fold at 360 × 640, so a runner gets the answer without scrolling or tapping.

| # | Element | Content | User action → behaviour |
| --- | --- | --- | --- |
| 1 | SiteHeader | Title, date label, `頁面更新 {HH:MM} · 重新整理` | `重新整理` → full reload of `/` |
| 2 | StaleBanner | Hidden unless E-02, E-03 or E-04 applies | `重新整理` → reload |
| 3 | Dual light card | Row 1 `主場 Main track`, row 2 `暖身場 Warm-up track`, always in this order and always both. Each row has a 48 px icon, the state word (24 px, bold), the window line, a reason line (when present), an annotation line (when present) and a stamp line | Stamp link → opens the source in a new tab. The rest of the row is not tappable |
| 4 | DisclaimerLine | `非官方資訊，出發前請再確認。官方公告` | `官方公告` → venue notice listing, new tab |
| 5 | 7-day outlook | Heading `未來 7 天`. A strip of 7 columns, today first. Each column shows the weekday, `M/D` and two stacked dots (top 主場, bottom 暖身場). Each dot holds a glyph: ✓ ½ ✕ ?. Legend: `上：主場　下：暖身場`. Below the strip, a `<details id="outlook-details">` with summary `查看每日原因` holds 7 rows of `日期 · 主場 {state}（{reason}）· 暖身場 {state}（{reason}）`, each with `id="day-YYYY-MM-DD"` | Tap a column (an `<a href="#day-YYYY-MM-DD">`) → the script opens the `<details>` and scrolls to the row. With JS off, the anchor scrolls to the details, and the user taps the summary to open it. Tap the summary → native toggle |
| 6 | Conditions | Heading `現在天氣`. Temperature `24°C`, humidity `78%`, rain chance `降雨機率 20%`, an AQI chip `AQI 48 良好`, and `{as_of} 觀測 · 中央氣象署、環境部`. When the typhoon flag is set, a red badge `颱風警報期間` | Not interactive. Hidden per E-06 and E-07 |
| 7 | Practical strip | Heading `入場資訊`: entrance, public fee, reserved lanes, floodlight hours, and a `在 Google 地圖開啟` button | Button → `https://www.google.com/maps/search/?api=1&query={STADIUM_LAT},{STADIUM_LNG}`, new tab |
| 8 | Recent changes | Heading `最近變動`. The 3 newest transitions, each: `{M/D HH:MM} · {venue} {from} → {to} · {cause} · 來源`. Then a link `全部變動紀錄 →` | `來源` → the transition's source, new tab. `全部變動紀錄` → `/history`. Empty per M-01 |
| 9 | Subscribe entry (v2) | Secondary button `明日燈號變動時通知我`, under element 5. Rendered only when `FEATURE_SUBSCRIBE=true` | → `/subscribe` |
| 10 | SiteFooter | As in shared components | Links as listed |

**Venue row: every state it can show**

| Claim + confidence | Light | Window line | Reason line | Stamp |
| --- | --- | --- | --- | --- |
| `open`, notice | Green ✓ 開放 | Phase copy | None | `依場館公告 · 10/14 · 查看公告` |
| `open`, regular hours | Green ✓ 開放 | Phase copy | None | `依公告開放時間 · 最近查核 06:12 · 查看規定` |
| `open`, human | Green ✓ 開放 | Phase copy | Override reason, if one was given | `人工確認 · 10/24 06:10` |
| `partial` | Amber ½ 部分開放 | Phase copy | `reason`. If empty: `僅部分時段或跑道開放` | Per confidence |
| `closed`, notice or human | Red ✕ 未開放 | Closed copy | `reason`. Always present: the type requires it | Per confidence |
| `closed`, inferred | Red ✕ 未開放 | Closed copy | `reason`, e.g. `全國田徑公開賽 1/31–2/4` | `由賽程推估 · 出發前請再確認 · 查看賽程` |
| `unknown` | Grey ? 狀態未確認 | `目前沒有資料涵蓋今日` | If `lastKnown`: `最後已知：{M/D} {state}（{confidence label}）`, in grey | `最近查核 06:12 · 查看官方公告` |

An active annotation adds one line under the reason: `註：{text}`. The two rows are independent. Any of the 16 claim combinations is valid, including one venue known and the other `unknown`.

**The inline script** (one `<script>`, no module, at most 40 lines, CSP hash):

1. On load, and on `visibilitychange` when the page becomes visible: run steps 2–4. This catches a phone that is woken at 06:30 with yesterday's tab still open.
2. Recompute each window line from `data-opens-at` and `data-closes-at` against `Date.now()`, using the phase table.
3. Read `data-generated-at` on `<body>`. Apply the freshness rules: show E-02 or E-03.
4. Compare the Taipei date of `now` with `data-date`. If they differ and the URL has no `r` param, `location.replace('/?r=' + Math.floor(Date.now()/60000))`. If they differ and `r` is present, show E-04.
5. Repeat steps 2–3 every 30 s.
6. Handle a click on an outlook column: set `#outlook-details` to `open`, then let the anchor scroll.

The script must not change claims, colours or any copy except the window line and the banner. With JS off, the server-rendered text stays correct as of publish time.

**P1 states**

| State | Trigger | What renders |
| --- | --- | --- |
| Success | A snapshot exists, is under 2 h old, and is for today | Elements 1–10 as specified |
| Partial data | One or both venues `unknown` | Grey row(s). The rest of the page is normal. This is a state, not an error |
| Delayed | E-02 | Amber banner, everything else normal |
| Stale | E-03 | Red banner and both rows `unknown` with last known. Outlook dots all grey. Conditions still shown |
| Wrong day | E-04 | Banner. Rows show the snapshot's date label, so the mismatch is visible |
| No snapshot | E-01 | P6 replaces the page |
| Weather down | E-06 / E-07 | Conditions block or AQI chip removed. No placeholder |

### P2 · Change log `/history`

A reverse-chronological list of the last 30 days of transitions, pre-rendered from `/api/history.json`. It is the public audit trail.

- **Layout:** SiteHeader, DisclaimerLine, heading `變動紀錄（近 30 天）`, then the list grouped by detection date. The group header is `{M/D（週）}`. Each item reads: `{HH:MM} · {venue} · {from_label} → {to_label}`, a second line `{cause}`, and a link `來源` (new tab). Items whose cause is an override show `人工覆寫` in place of a source link.
- **Filter:** none in v1.
- **Back:** the browser back button, or the header title → `/`.
- **Empty:** M-01. **Error:** if the history object is missing from KV, render the page with the line `暫時無法讀取變動紀錄。` and a link back to `/`, status 503.

### P3 · About `/about`

Static content. The TRD's User-Agent string points here, so the venue operator may read it too.

1. `這個網站在做什麼`: two sentences on the site's purpose and that it is unofficial.
2. `燈號怎麼判斷`: the four states with their icons, then the four confidence levels. Use the PRD's confidence table wording.
3. `資料來源`: a list of sources, each linked, with how often it is checked (`每小時最多一次`).
4. `我們不做的事`: no bookings, no accounts, no tracking.
5. `聯絡`: `{CONTACT_EMAIL}`, plus a line for the operator: `場館單位如希望我們調整或停止抓取，請來信，我們會在 48 小時內處理。`

No states beyond success: the page is static.

### P5 · Not found

HTTP 404. SiteHeader, then `找不到這個頁面`, then a primary button `回到今日燈號` → `/`.

### P6 · Snapshot unavailable

HTTP 503, `Cache-Control: no-store`, HTML inlined in the Worker so it renders even when KV has nothing. Copy is E-01. Primary button `前往官方公告` → the venue notice listing. Secondary link `重新整理` → `/`. It never shows a light.

## Login and signup flow

Visitors never log in or sign up, so no public screen has a login button, account link or profile. The only sign-in is the curator's, and it runs through Cloudflare Access with no auth code in the app.

**A0 · Curator sign-in (happy path)**

1. The curator opens `https://{DOMAIN}/admin` from a bookmark.
2. Cloudflare Access finds no valid `CF_Authorization` cookie and shows its hosted login page for the app `Track Status Admin`, with one button: `Sign in with Google`.
3. The curator taps it, chooses a Google account and consents.
4. Access checks the email against the policy allowlist (one address: `{CURATOR_EMAIL}`). On a match it sets the cookie for 8 h, scoped to `/admin*`, and redirects back to the URL from step 1.
5. On every `/admin*` request the Worker verifies the `Cf-Access-Jwt-Assertion` header: signature against the team JWKS, `aud` equal to `{ACCESS_AUD}`, and expiry. On success it reads `email` and stores it as the actor on every write.
6. A1 Dashboard renders. **Success.**

**Sign-in states**

| State | Trigger | What the curator sees | Recovery |
| --- | --- | --- | --- |
| Success | Allowed email, valid JWT | A1 Dashboard | — |
| Not allowed | Google email not on the allowlist | Cloudflare's denied page. Set its custom text to `此帳號沒有管理權限。` | `改用其他帳號` (Cloudflare's own link) |
| Cancelled | Curator backs out of the Google screen | Back on the Access login page | Tap `Sign in with Google` again |
| JWT invalid at the Worker | Header missing, bad signature, or wrong `aud`. Means an Access misconfiguration | 403 page (E-12) | `重新登入` → `/admin` |
| Session expired on a read | 8 h passed, curator taps a nav link | Access login (step 2), then the same URL | Sign in again |
| Session expired on a write | 8 h passed while the form was open | Access login, then a redirect to the **GET** of the same form. The POST body is lost | E-13: the form restores the draft from `sessionStorage` and shows `已恢復未送出的草稿，請確認後再發布。` |

**"Signup": adding or removing a curator.** This happens outside the app. Add the email to the Access policy in the Cloudflare dashboard. To remove someone, delete the email and use `Revoke existing sessions`. No in-app UI exists for this, and the coding agent must not build one.

**Sign out.** `登出` in the admin nav links to `/cdn-cgi/access/logout`. Cloudflare shows its signed-out page. Set its custom text to `已登出。` with a link `回到公開頁面` → `/`.

## Admin screens and flows

The admin's main job is PRD story 7: a known closure published by hand within 60 seconds, from a phone at 06:00. Every admin screen therefore works at 360 px wide. The TRD keeps the admin limited on purpose: it can write overrides and annotations, mute sources, republish and read the audit log. It cannot edit facts, delete audit rows or deploy.

**Admin chrome (A1–A6).** A top bar shows `管理後台`, the signed-in email in grey, and a wrapping row of nav links: `總覽` → `/admin` · `覆寫` → `/admin/overrides` · `資料來源` → `/admin/sources` · `對帳` → `/admin/reconcile` · `稽核紀錄` → `/admin/audit` · `登出`. The current page's link is bold, with `aria-current="page"`. Flash messages appear under the bar and come from a `?flash={code}` param, read once.

### A1 · Dashboard `/admin`

The screen is ordered by urgency: alerts, then what the public sees, then the tools.

| Section | Content | Actions |
| --- | --- | --- |
| Alerts | One card per open alert: source hard-stopped (E-19), parse shape failure, claim flip-flop (more than 2 flips a day), override share over 30% in 14 days, reconciliation false green. Each shows the time and a one-line cause | `查看` → the related screen. Empty: M-06 |
| Public preview | Today's dual light card exactly as P1 renders it, using the same component. Below it: `快照 {generated_at} · {snapshot_key}` | `開啟公開頁面` → `/`, new tab |
| Quick actions | Primary `新增覆寫` and secondary `立即重新發布` | See below |
| Active overrides | Up to 3 active or scheduled overrides and annotations, each `{venue} · {M/D–M/D} · {claim chip} · 到期 {M/D HH:MM}` | `全部` → A3. Empty: M-05 |
| Source health | One line per source: name, state chip (`正常` / `降級` / `已靜音` / `已停用`), last fetch time | `管理` → A4 |

**Republish now.** Tap `立即重新發布` → the button turns into a disabled spinner reading `發布中…` → `POST /admin/publish`. The Worker runs `publish`, then purges the CDN for `/`, `/history` and `/api/*`. On success: redirect to `/admin?flash=published`, showing `已重新發布 · {HH:MM}`. If publish fails: E-20. If the purge fails: E-17. No confirm dialog, because publishing is idempotent.

**Addition: CDN purge on publish.** The TRD caches `/` for `s-maxage=300`, which breaks the 60-second override promise. Every `publish` triggered by an override, an annotation, a mute or this button purges those URLs through the Cloudflare cache API. Scheduled publishes do not purge.

### A2 · New override or annotation `/admin/overrides/new`

One form with a type switch at the top: `類型：○ 覆寫燈號 ○ 只加註說明`. The default is `覆寫燈號`. Query params prefill the form: `?venue=&from=&to=&claim=&reason=` (used by "copy as new" on A3).

**Addition: annotations.** PRD story 9 asks for a free-text note on a date range that shows on the reason line. The TRD's `override.note` is internal, and an override changes the claim. So add a table `annotation(id, venue, date_from, date_to, text, created_by, created_at, expires_at NOT NULL)`. The renderer shows it as `註：{text}`. It never changes a claim or a confidence level.

| Field | Control | Required | Default | Validation → error copy |
| --- | --- | --- | --- | --- |
| 場地 `venue` | Radio: `主場` / `暖身場` / `兩者` | Yes | None | `請選擇場地。` |
| 起始日期 `date_from` | Date | Yes | Today (Taipei) | Before today → `起始日期不能早於今天。` |
| 結束日期 `date_to` | Date | Yes | Same as `date_from` | Earlier than start → `結束日期不能早於起始日期。` More than 30 days after start → `單次最多 30 天。` |
| 燈號 `claim` (override only) | Radio: `開放` / `部分開放` / `未開放` / `狀態未確認` | Yes | None | `請選擇燈號。` |
| 開放時段 `window_start`, `window_end` | Two time inputs; shown only for `開放` or `部分開放` | When shown | 08:00 / 22:00 | Start not before end → `開始時間需早於結束時間。` |
| 公開原因 `reason_text` | Text, max 60 characters, with a live counter `{n}/60` | For `未開放` and `部分開放` | Empty | Missing → `未開放或部分開放時必須填寫原因。` Too long → `原因最多 60 字。` |
| 註記內容 `text` (annotation only) | Text, max 60 characters | Yes | Empty | `請填寫註記內容。` |
| 內部備註 `note` (override only) | Textarea, max 500 characters. Never shown publicly | No | Empty | `備註最多 500 字。` |
| 到期時間 `expires_at` | Date-time | Yes | `date_to` at 23:59 Taipei | In the past → `到期時間必須晚於現在。` More than 31 days from now → `到期時間最多 31 天後。` |

The form shows field errors under each field in red, plus a summary at the top: `有 {n} 個欄位需要修正。` Focus moves to the first invalid field. Server validation repeats every rule; the client check is only a convenience.

**Live preview.** On the right on desktop, or below the fields on mobile, the form shows the P1 venue row(s) as they will render with these values. It updates on every input. The script also saves the draft to `sessionStorage` under `draft:override` on every input, and clears it after a successful publish.

**Buttons**

- `發布` (primary). Runs client validation, then the guard dialogs below, then `POST /admin/overrides` (or `/admin/annotations`). The button becomes `發布中…` and is disabled to block double submits.
- `取消` (text button). If the form is unchanged → back to `/admin`. If it has changes → native `confirm('放棄未儲存的變更？')`. OK clears the draft and goes to `/admin`. Cancel stays on the form.

**Guard dialogs** (native `confirm`, before the POST)

- **Raising to open.** The new claim is `開放` or `部分開放`, and the current resolved claim for any covered venue-day is `closed` or `unknown`: `你將把{venue} {M/D–M/D} 設為「{claim}」，覆蓋目前的「{current}」。錯誤的綠燈會讓人白跑一趩，確定嗎？` This is the most dangerous action in the product, so it is the only one with a warning in plain words.
- **Overlap.** An active override already covers part of the range: `此期間已有生效中的覆寫（{summary}）。新覆寫將優先。` Resolver rule: among unexpired overrides for the same venue-day, the newest `created_at` wins. Old rows are never edited.

**After the POST**

1. The server validates. If invalid: 422, the form re-renders with values and errors (E-14).
2. It inserts the row, or two rows when `兩者` is chosen, plus an `audit` row in one D1 transaction. If that fails: E-15.
3. It runs `publish` with a 10 s timeout, then the CDN purge.
4. On success: 303 redirect to `/admin?flash=override_published`, showing `已發布。公開頁面約 1 分鐘內更新。` The dashboard preview already shows the new state. **Success state.**
5. Saved but publish failed: E-16. Published but purge failed: E-17.

### A3 · Overrides list `/admin/overrides`

Three sections, each newest first: `生效中` (started, not expired), `排定中` (starts in the future), `已到期（近 30 天）`. Annotations share the list and carry a `註記` chip. Each row shows venue, date range, claim chip, reason or text, `到期 {M/D HH:MM}` and `created_by`.

| Action | Shown on | Behaviour |
| --- | --- | --- |
| `新增覆寫` (top) | Always | → A2 |
| `立即結束` | Active and scheduled rows | `confirm('結束這筆{覆寫或註記}？燈號會回到自動判定。')` → `POST /admin/overrides/{id}/end` sets `expires_at = now`, writes audit, publishes and purges → flash `已結束，燈號回到自動判定。` |
| `複製為新覆寫` | All rows | → A2 with the query params prefilled. Dates are reset to today if they are in the past |

No edit and no delete: rows are append-only, as in the TRD. Empty sections: M-05 for active, `沒有排定中的覆寫。` for scheduled, and M-09 for expired.

### A4 · Sources `/admin/sources`

One card per source in the committed allowlist: name, kind, URL (opens in a new tab), state chip, `最近抓取 {M/D HH:MM} · HTTP {status}`, `連續失敗 {n} 次`, and `靜音至 {M/D HH:MM}` when muted.

| Action | Enabled when | Behaviour |
| --- | --- | --- |
| `靜音` | Not muted | Opens an inline panel with `靜音至` (date-time, default now + 24 h, max 7 days) and `原因` (required, max 100 characters). The panel shows an impact line, computed by running the resolver without this source: `靜音後，未來 7 天有 {n} 個場地日會改變燈號。` Then `確認靜音` → POST, audit, publish and purge → flash `已靜音 {source}。` |
| `解除靜音` | Muted | POST, audit, publish → flash `已解除靜音。` |
| `清除失敗計數` | `consecutive_failures ≥ 3` (hard-stopped) | `confirm('清除後將在下次排程恢復抓取。確定要恢復嗎？')` → reset to 0 and audit → flash `已恢復抓取。` |
| `立即抓取` | Last fetch is older than the source's `min_interval_s` | Runs one conditional fetch through the shared wrapper → flash `抓取完成 · HTTP {status}`. When too soon, the button is disabled with the hint `距上次抓取未滿 {n} 分鐘` (E-18) |

A source disabled by `robots.txt` shows the chip `已停用` with the line `robots.txt 不允許抓取，請勿繞過。` It offers no actions.

### A5 · Reconciliation `/admin/reconcile`

**Addition:** the TRD describes the nightly reconciliation job but has no table for it. Add `reconciliation(venue, date, claimed_0600, claimed_1800, actual, filled_by, filled_at)`, with primary key `(venue, date)`. A job at 18:30 Taipei writes each day's row.

- **Layout:** a table of the last 14 days, newest first. Columns: `日期`, `場地`, `06:00 顯示`, `18:00 顯示`, `實際狀況`, `結果`. The "actual" column is a select per row: `—` / `開放` / `部分開放` / `未開放` / `未觀察`.
- **Result chip:** `相符` (green), `錯誤紅燈` (amber: the page said closed, the venue was open), `錯誤綠燈` (red: the page said open, the venue was closed), or blank.
- **Save:** one `儲存` button at the bottom posts every changed row → flash `已儲存 {n} 筆。`
- **On a false green:** after save, a red alert appears at the top: `記錄到錯誤綠燈（{M/D} {venue}）。請在 repo 的 incidents/ 寫事件紀錄，並新增測試案例。` The A1 alert stays until the incident is marked done with `標示已處理`.
- **Progress line** at the top: `連續相符 {n} / 14 天`, which is the PRD's definition of done.
- **Empty:** M-08.

### A6 · Audit log `/admin/audit`

Read-only, newest first, 50 rows per page, with `上一頁` / `下一頁` (`?before={id}`). Each row: `{M/D HH:MM:SS} · {actor} · {action}`, and a `<details>` holding `payload_json`, pretty-printed. One filter select, `動作`: `全部` / `覆寫` / `註記` / `靜音` / `重新發布` / `對帳`. Changing it reloads with `?action=`. Empty: M-07.

## Subscription flow (v2, behind a flag)

Build this only when `FEATURE_SUBSCRIBE=true`. While the flag is off, `/subscribe`, `/feed.ics` and `/api/push/*` return 404 and the P1 entry button does not render. Subscribing never creates an account. The server stores only the push endpoint, its keys, the chosen venues and `created_at`.

### P4 · Subscribe `/subscribe`

Heading `明日燈號變動通知`. Intro: `只在每天 18:00 後偵測到明日燈號改變時通知你，燈號沒變就不會打擾。` Below it are two cards.

**Card A · Push** (`推播通知`): checkboxes `主場` and `暖身場`, both checked by default, then a primary button `開啟推播`.

1. On load, the script calls `navigator.serviceWorker.getRegistration()` and `pushManager.getSubscription()`. If a subscription exists, render the **subscribed** state straight away. No local storage is needed.
2. Tap `開啟推播`. If no venue is checked, show inline `請至少選擇一個場地。` and stop.
3. Support check. If `serviceWorker` or `PushManager` is missing, show S-01. On iOS Safari outside standalone mode, show S-02.
4. `Notification.requestPermission()`. Granted → step 5. Denied → S-03. Dismissed → back to idle, with the grey line `尚未開啟推播。`
5. Register `/sw.js`, call `pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: VAPID_PUBLIC })`, then `POST /api/push/subscribe` with `{endpoint, keys, venues}`.
6. On 201, show the **subscribed** state: the button becomes a disabled `已開啟 ✓`, with two text buttons below it, `傳送測試通知` and `取消推播`. If the POST fails: S-04.

- `傳送測試通知` → `POST /api/push/test`. The notification reads `測試通知 · 推播已開啟`. It is rate-limited to once per 10 minutes per endpoint; when too soon, show `請稍後再試。`
- `取消推播` → `subscription.unsubscribe()` plus `DELETE /api/push/subscribe` → idle state, with the line `已取消推播。`
- Changing a venue checkbox while subscribed → `POST` again with the new venues → the inline line `已更新。`

**Card B · Calendar** (`行事曆訂閱`): `把未開放的日子自動加入你的行事曆。`

- `加入 Google 日曆` → `https://calendar.google.com/calendar/r?cid=webcal://{DOMAIN}/feed.ics`, in a new tab.
- `加入 Apple / Outlook 行事曆` → `webcal://{DOMAIN}/feed.ics`.
- A read-only input holds `https://{DOMAIN}/feed.ics`, with a `複製網址` button that calls `navigator.clipboard.writeText` and shows a 2-second inline `已複製`. With JS off, the input is still long-press copyable.
- The feed holds closed and partial days as all-day events, titled `{venue} {state}：{reason}`.

**Push delivery rules**

- After 18:00 Taipei, any `publish` that changes **tomorrow's** claim for a venue, compared with the last value notified for it, queues one notification per subscriber of that venue. It must be sent within 15 minutes.
- No send when re-checks leave tomorrow unchanged. No send before 18:00. Same-day changes are not pushed.
- Payload title: `明日燈號變動：{venue} {to_label}`. Body: `{M/D（週）}{reason}。{other venue}：{state} {window}`. Tag: `tomorrow-{YYYY-MM-DD}`, so a later change replaces the earlier notification.
- Tapping the notification opens `/`. When the push service answers 404 or 410, delete the subscription row.
- If any subscriber gets more than 2 notifications in a week, raise an A1 alert. This is the PRD counter-metric; the cap is not enforced on users.

**Subscribe states**

| ID | Trigger | Copy | Action offered |
| --- | --- | --- | --- |
| S-01 | Browser has no push support | `這個瀏覽器不支援推播通知，可以改用下方的行事曆訂閱。` | Scrolls to Card B |
| S-02 | iOS Safari, not opened from the home screen | `iPhone 需先將本站加入主畫面，再從主畫面開啟，才能使用推播（iOS 16.4 以上）。` Then 3 steps: `點分享 → 加入主畫面 → 從主畫面開啟本站` | Card B as the alternative. Needs a `manifest.webmanifest` with `display: standalone` |
| S-03 | Permission denied | `你已封鎖本站的通知。請到瀏覽器的網站設定允許通知後，再回來重試。` | `重試` re-runs the permission check |
| S-04 | Subscribe POST failed | `訂閱沒有完成，請稍後再試。` The client also calls `unsubscribe()`, so no orphan subscription is left | `重試` |
| S-05 | JS disabled | `<noscript>`: `推播通知需要開啟 JavaScript。` | Card B still works |

## Payment and upgrade

**Recommendation: build no payment or upgrade flow, in v1 or v2.** There is nothing to unlock. The product's only value is one correct answer, and gating it would break the habit it depends on.

- **The PRD rules it out.** "Monetisation, ads, sponsorship" is out of scope because it "changes the relationship with a public venue and with users for trivial revenue."
- **No natural premium tier exists.** Push alerts are the only candidate, and charging for them would need accounts, which the TRD keeps out to stay clear of 個資法 duties.
- **Costs don't need covering.** The TRD estimates NT$400–800 a year for the domain, plus NT$0–150 a month if Workers Paid is ever needed.

The coding agent must not add pricing pages, "Pro" badges, upgrade prompts, a donation button or payment SDKs. If this changes later, the least harmful option is a plain `mailto:` or an external donation link on `/about` only, with no state kept on the device.

## Error and empty state catalog

Every non-happy state has one ID, one trigger and one exact string. Screens reference these IDs. A failure on the public side always degrades toward `unknown` or a banner. It never shows a blank page or a guessed green light.

**Errors**

| ID | Screen | Trigger | Renders | Copy | Recovery |
| --- | --- | --- | --- | --- | --- |
| E-01 | P1 → P6 | No KV snapshot, or a KV read error | P6, HTTP 503, no-store | Title `暫時無法讀取燈號`. Body `本站目前無法提供資料，請直接查看官方公告。` | `前往官方公告`, `重新整理` |
| E-02 | P1 | Snapshot older than 2 h (script check) | Amber StaleBanner | `本頁 {n} 小時未更新（最後更新 {HH:MM}），燈號可能已過時。` | `重新整理` |
| E-03 | P1 | `stale: true`, or snapshot older than 48 h | Red StaleBanner, both rows forced to `unknown` | `資料已超過 48 小時未更新，燈號暫停判定。請以官方公告為準。` | `官方公告` link |
| E-04 | P1 | Taipei date ≠ snapshot date after one reload | Amber StaleBanner | `本頁仍是 {M/D} 的資料，請稍後再重新整理。` | `重新整理` |
| E-06 | P1 | CWA data missing or older than 3 h | Conditions block removed | None | Next publish |
| E-07 | P1 | MOENV data missing or older than 3 h | AQI chip removed | None | Next publish |
| E-08 | Any public | Unknown path | P5, HTTP 404 | `找不到這個頁面` | `回到今日燈號` |
| E-09 | P2 | History object missing from KV | P2 shell, HTTP 503 | `暫時無法讀取變動紀錄。` | `回到今日燈號` |
| E-12 | A1–A6 | Access JWT missing or invalid at the Worker | 403 page | `無法驗證登入狀態，請重新登入。` | `重新登入` → `/admin` |
| E-13 | A2 | Session expired on submit | A2 with the draft restored, info banner | `已恢復未送出的草稿，請確認後再發布。` | `發布` |
| E-14 | A2, A4 | Validation failed (client or server 422) | Field errors plus a top summary | `有 {n} 個欄位需要修正。` Field copy as in A2 | Fix and resubmit |
| E-15 | A2–A5 | D1 write failed | Same form, values kept, red flash, HTTP 500 | `儲存失敗，變更沒有生效。請再試一次。` | `發布` again |
| E-16 | A1 after a write | Saved, but `publish` failed or timed out | Amber flash | `已儲存，但重新發布失敗。系統會在下次排程（最遲 30 分鐘）自動套用。` | `再試一次發布` |
| E-17 | A1 after a write | Published, but the CDN purge failed | Amber flash | `已發布，但快取清除失敗；公開頁面最多 5 分鐘後更新。` | None needed |
| E-18 | A4 | `立即抓取` used inside `min_interval_s` | Button disabled, hint shown | `距上次抓取未滿 {n} 分鐘` | Wait |
| E-19 | A1, A4 | Source hit 3 consecutive failures | Red alert card | `{source} 連續 3 次抓取失敗，已停止抓取。受影響的日期顯示為「狀態未確認」。` | `查看` → A4 |
| E-20 | A1 | `立即重新發布` failed | Red flash | `重新發布失敗（{code}）。公開頁面維持上一版。` | Retry |

IDs E-05, E-10 and E-11 are unused. There is no E-05 because an `unknown` venue is a normal state, specified under P1. Network loss on the visitor's phone shows the browser's own offline page, because v1 has no service worker.

**Empty states**

| ID | Screen | Condition | Copy | Action |
| --- | --- | --- | --- | --- |
| M-01 | P1 element 8, P2 | No transitions in the last 30 days | `過去 30 天沒有燈號變動。` | P1 keeps the `全部變動紀錄` link |
| M-02 | P1 element 7 | Practical data never cached | Section removed | — |
| M-03 | P1 element 5 | One day has no data | Grey `?` dot. Row text `尚無資料` | — |
| M-04 | P1 element 5 | All 7 days are `unknown` | 7 grey dots, plus the line `未來幾天尚無公告。` | — |
| M-05 | A1, A3 | No active overrides | `目前沒有生效中的人工覆寫。` | `新增覆寫` |
| M-06 | A1 | No open alerts | `所有資料來源正常。` | — |
| M-07 | A6 | No audit rows match | `尚無操作紀錄。` | `清除篩選` when a filter is set |
| M-08 | A5 | No reconciliation rows yet | `尚無對帳資料。每天 18:30 會自動產生當天的紀錄。` | — |
| M-09 | A3 | No expired overrides in 30 days | `最近 30 天沒有已到期的覆寫。` | — |

## Navigation paths and acceptance criteria

**Navigation matrix:** every link and button that leaves its screen.

| From | Action | To | Opens in |
| --- | --- | --- | --- |
| P1 | `重新整理` (header or banner) | `/` | Same tab |
| P1 | Stamp link (`查看公告` / `查看賽程` / `查看規定` / `查看官方公告`) | Source URL | New tab |
| P1 | `官方公告` (DisclaimerLine) | Venue notice listing | New tab |
| P1 | Outlook column | `#day-YYYY-MM-DD` | Same page |
| P1 | `在 Google 地圖開啟` | Google Maps | New tab |
| P1 | `來源` on a recent change | Source URL | New tab |
| P1 | `全部變動紀錄 →` | `/history` | Same tab |
| P1 | `明日燈號變動時通知我` (v2) | `/subscribe` | Same tab |
| P1–P5 | Footer `關於本站` / `資料 API` / `系統狀態` / `聯絡我們` | `/about` / `/api/status.json` / `/health` / mail app | Same tab / same / same / mail app |
| P2–P5 | Header title | `/` | Same tab |
| P5, E-09 | `回到今日燈號` | `/` | Same tab |
| P6 | `前往官方公告` / `重新整理` | Venue notice listing / `/` | New tab / same |
| P4 | `加入 Google 日曆` / `加入 Apple / Outlook 行事曆` | Google Calendar / `webcal://` handler | New tab / OS handler |
| Push notification | Tap | `/` | Browser |
| Bookmark | Open `/admin` | A0 if not signed in, else A1 | Same tab |
| A1–A6 | Nav links | A1 / A3 / A4 / A5 / A6 | Same tab |
| A1–A6 | `登出` | `/cdn-cgi/access/logout`, then `/` | Same tab |
| A1 | `新增覆寫` / `全部` / `管理` / alert `查看` | A2 / A3 / A4 / related screen | Same tab |
| A1 | `開啟公開頁面` | `/` | New tab |
| A2 | `發布` success / `取消` | A1 with flash / A1 | Same tab |
| A3 | `新增覆寫` / `複製為新覆寫` | A2 / A2 prefilled | Same tab |
| A3, A4, A5 | Any successful POST | Same screen with flash (PRG, 303) | Same tab |

The browser back button works on every screen, because no screen uses client-side routing. Every POST ends in a 303 redirect, so refresh never resubmits.

**Acceptance criteria**

- [ ] At 360 × 640, P1 elements 1–4 (both lights, both window lines, the disclaimer) are visible without scrolling.
- [ ] P1 renders correctly with JavaScript disabled: correct lights, absolute times, the outlook details reachable.
- [ ] P1 HTML is under 20 KB gzipped, with no JS bundle and at most 2 requests (HTML + CSS).
- [ ] Both venue rows always render, in every one of the 16 claim combinations, each with an icon, a text state and an `aria-label`.
- [ ] No input path produces a green light except a parsed in-date fact or an unexpired override. A malformed snapshot renders `unknown`.
- [ ] Every status shows a confidence stamp, a time and a source link.
- [ ] Waking a phone with a tab from yesterday shows today's data within one automatic reload, or shows E-04.
- [ ] After closing time, the window line reads `今日開放已結束`, and it updates within 30 s with JS on.
- [ ] With the snapshot older than 48 h, both rows show `unknown` and the E-03 banner.
- [ ] Public pages set no cookies and no local storage, and make no third-party requests.
- [ ] `/admin/*` without a valid Access JWT returns 403 (E-12), checked in the CI smoke test.
- [ ] A curator can publish an override from a phone, and the public `/` reflects it within 60 s.
- [ ] Raising a closed or unknown day to open always shows the guard dialog.
- [ ] An override or annotation cannot be saved without `expires_at`, at the API boundary as well as in the schema.
- [ ] Every admin write creates exactly one audit row per affected record, with the Access email as actor.
- [ ] Every string in this spec comes from `src/copy.ts`. No UI text is hard-coded in components.
- [ ] No payment, account, signup, analytics or booking UI exists anywhere.
- [ ] With `FEATURE_SUBSCRIBE=false`, `/subscribe`, `/feed.ics` and `/api/push/*` return 404, and P1 shows no subscribe button.
