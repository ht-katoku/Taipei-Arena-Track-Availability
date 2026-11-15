# UI/UX Design Brief — Taipei Track Status Board

Nov 5, 2026 · @Katoku · Companion to PRD v0.1 and App Flow Spec (10/24)

The site should look like a piece of public signage, not an app: one high-contrast status card, readable at arm's length at 06:30, with everything else quietly below it. This brief turns PRD v0.1 and the App Flow Spec into visual and interaction rules an AI app builder can apply without guessing.

**Precedence when sources disagree**

1. `src/copy.ts` and the App Flow Spec decide **what** each screen says and does: routes, states, copy IDs (E-xx, M-xx, S-xx) and behaviour.
2. This brief decides **how it looks**: tokens, type, spacing, component anatomy and responsive layout.
3. The PRD decides **why**. Use it to break ties the other two don't settle.

Where this brief adds a rule the spec lacks, it is marked **Addition**. Hex values, sizes and breakpoints below are final unless a contrast check fails. Never swap them for a framework's default theme.

**Build stack assumed:** Astro static output for public pages (no JS bundle, one inline script on `/`), Hono SSR for `/admin`, one hand-written CSS file, inline SVG icons, system fonts. No UI kit, no Tailwind preset colours, no icon font, no web fonts.

## 1. Design north star and UX principles

**North star: a 3-second glance answers "go or don't go" for both tracks, and the page never looks more certain than its data.** Every principle below serves one of those two halves.

| # | Principle | What it means on screen | Test |
| --- | --- | --- | --- |
| 1 | **Answer first, detail later** | Both lights, both window lines and the disclaimer sit above the fold at 360 × 640. Everything else is optional reading below them | Screenshot at 360 × 640 shows both state words without scrolling |
| 2 | **Legible at arm's length** | The state word is the largest text on the page (24 px bold). The light is a 48 px solid disc. One state word per venue, never a sentence | Readable from 60 cm in bright daylight with the phone at 50% brightness |
| 3 | **Certainty is visible** | Confidence is a styled stamp, not footnote text. An inferred status looks visibly softer than a confirmed one: a dashed disc ring and the words `出發前請再確認` | A reader can say how sure the page is without reading the stamp's wording |
| 4 | **Grey is honest, not broken** | `狀態未確認` gets the same size, weight and layout as the other three states. It is never an error page, a spinner or an empty box | Unknown rows have the same height and anatomy as known rows |
| 5 | **Never colour alone** | Each state is an icon + a word + a colour + an `aria-label`. Colour is the last of the four to notice | Page still makes sense in greyscale and in Windows forced-colours mode |
| 6 | **Two venues, always two rows** | 主場 is always on top and 暖身場 below, in the same order and layout, even when one is unknown | All 16 claim combinations render two equal-weight rows |
| 7 | **Calm by default, loud only when wrong** | The page has no motion, no badges and no promotional colour. Banners and red appear only when something is closed, stale or failing | A normal open day has no element in red or amber |
| 8 | **Civic, unofficial and polite** | Looks like public information but never like the operator's site: no city emblem, no government blue-and-white, no imitation of 臺北市政府體育局 branding. The disclaimer line is always visible | Nobody could mistake a screenshot for an official notice |
| 9 | **Thumb-first, one hand** | All tap targets are at least 44 × 44 px. Primary actions sit in the lower half on mobile. Nothing requires a long press, swipe or hover | Every action works one-handed on a 360 px wide phone |
| 10 | **Fast is a design decision** | System fonts, inline SVG, no images, no web fonts, no third-party requests. Visual richness comes from type and spacing, not assets | P1 stays under 20 KB gzipped with at most 2 requests |

**The emotional target:** the confidence of a train departure board, the honesty of a status page, the restraint of street signage. The runner should feel informed, not marketed to.

## 2. Design style and visual direction

**Style name: "Trackside Signal Board."** It is flat and typographic: a neutral paper surface, one ink colour, four status colours, and nothing decorative. Think of a railway operation-status board crossed with bilingual metro wayfinding.

**Core metaphor:** a signal post at the edge of a track. Each venue is one signal head, a solid disc you read before you read any words. The rest of the page is the timetable pinned beside it.

**Mood words:** calm, factual, bilingual, trustworthy, early-morning. **Not:** sporty, energetic, gamified, premium, playful.

**Signature details (use all of them, sparingly)**

- **Lane-line rule.** The divider between the two venue rows, and under the SiteHeader, is a 2 px line in `--line-strong`. It is the only nod to track markings. No running-track illustrations, no lane numbers and no stadium photos.
- **Status edge.** Each venue row has a 6 px solid bar on its leading edge in that row's status fill colour. With the disc, this gives two colour cues per row that survive glare.
- **Bilingual stacking.** Chinese label first, English underneath at about 60% of the size in `--ink-2`. This follows metro-sign hierarchy: zh is the content and en is the caption.
- **Tabular time.** Every time, date and duration uses tabular numerals, so `06:12` and `22:00` align like a departure board.

**Do / Don't**

| Do | Don't |
| --- | --- |
| Flat fills and 1 px borders | Gradients, glassmorphism, neumorphism, drop-shadow cards |
| One brand accent (signal blue) for links and focus only | Brand colour on large areas, or any brand colour that is green, amber, red or grey |
| Inline SVG icons, 2 px stroke | Emoji, icon fonts, raster images, illustrations, mascots |
| Generous whitespace around the light card | Dense dashboards, multiple cards competing above the fold |
| Plain words in the operator's own venue names | Marketing taglines, exclamation marks, "Let's go!" copy |
| Status colour only where it carries status | Decorative green "success" ticks on things that aren't a venue state |
| Light and dark themes that follow the OS | A theme toggle, which would need storage |

**Admin look:** same tokens, denser spacing, and an ink-coloured top bar (`--ink` background, white text). The dark bar tells the curator at a glance that they are in the back office, not on the public page. **Addition.**

## 3. Color palette

The palette is neutral paper and ink plus four status sets, and every status set has four tokens: text, fill, glyph and tint. All ratios below were computed against WCAG 2.x relative luminance. Text tokens clear 4.5:1 on both `--bg` and `--surface` in both themes, which satisfies the spec's contrast rule.

**Status sets** (the spec's `--status-*` names are the text tokens)

| State | Token | Light | Dark | Use | Contrast (light / dark) |
| --- | --- | --- | --- | --- | --- |
| 開放 open | `--status-open` | `#13753C` | `#4CC97A` | State word, small icons | 5.77 / 8.19 on surface |
|  | `--status-open-fill` | `#1E8E4A` | `#3DBA6C` | 48 px disc, status edge, outlook dot | 4.18 / 6.95 vs surface |
|  | `--status-open-glyph` | `#FFFFFF` | `#0E1114` | ✓ on the disc | 4.18 / 7.61 |
|  | `--status-open-tint` | `#E7F4EC` | `#14281C` | Chip and banner background | text on tint 5.10 / 7.37 |
| 部分開放 partial | `--status-partial` | `#8F5200` | `#F2B544` | State word | 6.22 / 9.45 |
|  | `--status-partial-fill` | `#C27C00` | `#E8A93A` | Disc, edge, dot | 3.40 / 8.37 |
|  | `--status-partial-glyph` | `#16191D` | `#0E1114` | ½ on the disc (dark glyph in both themes) | 5.19 / 9.17 |
|  | `--status-partial-tint` | `#FDF2DC` | `#2E2410` | Amber banner (E-02, E-04), chips | 5.60 / 8.33 |
| 未開放 closed | `--status-closed` | `#C0262D` | `#FF7A7A` | State word | 5.90 / 6.85 |
|  | `--status-closed-fill` | `#D32F2F` | `#F26363` | Disc, edge, dot | 4.98 / 5.55 |
|  | `--status-closed-glyph` | `#FFFFFF` | `#0E1114` | ✕ on the disc | 4.98 / 6.08 |
|  | `--status-closed-tint` | `#FBE9E9` | `#311819` | Red banner (E-03), error flash | 5.04 / 6.52 |
| 狀態未確認 unknown | `--status-unknown` | `#5E6670` | `#9AA3AD` | State word, "last known" line | 5.82 / 6.77 |
|  | `--status-unknown-fill` | `#7A828C` | `#8A939D` | Disc, edge, dot | 3.89 / 5.55 |
|  | `--status-unknown-glyph` | `#FFFFFF` | `#0E1114` | ? on the disc | 3.89 / 6.08 |
|  | `--status-unknown-tint` | `#EEF0F2` | `#20252B` | Chips | 5.09 / 6.04 |

The light-mode amber fill was darkened from a brighter `#F0A500`, which only reached 2.08:1 against white and would fail the 3:1 rule for graphics. Keep `#C27C00`.

**Neutrals and brand**

| Token | Light | Dark | Use |
| --- | --- | --- | --- |
| `--bg` | `#F6F7F8` | `#0E1114` | Page background |
| `--surface` | `#FFFFFF` | `#171B20` | Cards, light card, inputs |
| `--ink` | `#16191D` | `#ECEFF2` | Primary text (17.6:1 / 15.0:1) |
| `--ink-2` | `#4A525C` | `#A9B1BA` | Secondary text, English captions, stamps (7.9:1 / 8.0:1) |
| `--line` | `#D5D9DE` | `#2C333B` | 1 px borders, table rules |
| `--line-strong` | `#AEB5BD` | `#48515B` | 2 px lane-line rules |
| `--brand` | `#1F4FD1` | `#7FA6FF` | Links, focus ring, primary button (6.8:1 / 7.3:1). Signal blue is the only non-status hue on the page |
| `--brand-ink` | `#FFFFFF` | `#0E1114` | Text on primary buttons |
| `--admin-bar` | `#16191D` | `#000000` | Admin top bar background, with white text |

**Colour rules for the builder**

- Status colours appear **only** on venue state: the light card, outlook dots, change-log from/to chips, A5 result chips and the stale banners that downgrade state. Nothing else on the page may be green, amber or red.
- Admin "success" flashes use `--brand` on `--surface` with a border, not green, so green always means "track open".
- The **AQI chip** stays neutral: `--surface` background, `--line` border, `--ink` text, plus a 10 px square swatch in the MOENV category colour. This stops a red AQI reading looking like a closed track.
- The **typhoon badge** (`颱風警報期間`) uses `--status-closed` text on `--status-closed-tint`, with a warning icon. It sits inside the Conditions block, never on the light card.
- Theme switches only with `prefers-color-scheme`. Light is the default, since it reads best in sunlight.
- In `forced-colors: active` mode, icons use `currentColor` and the status edge becomes a `CanvasText` border, so the glyph and word still carry the state. **Addition.**

## 4. Typography

**Use system fonts only.** A web font would add a third request, and the self-hosted Noto Sans TC subset would cost far more than the 20 KB page budget. Native CJK faces are already well hinted on every target phone.

```css
--font-sans: -apple-system, BlinkMacSystemFont, "PingFang TC", "Noto Sans TC",
             "Noto Sans CJK TC", "Microsoft JhengHei", "Segoe UI", Roboto,
             system-ui, sans-serif;
--font-mono: ui-monospace, "SF Mono", Menlo, Consolas, monospace; /* admin JSON only */
```

**Type scale** (mobile base; desktop is in section 9)

| Token | Size / line-height | Weight | Used for |
| --- | --- | --- | --- |
| `--t-state` | 24 / 30 px | 700 | State word on the light card (`開放`, `未開放`). The largest text on P1 |
| `--t-title` | 20 / 28 px | 700 | Page H1: `臺北田徑場開放燈號`, `變動紀錄（近 30 天）` |
| `--t-venue` | 18 / 24 px | 600 | Venue label `主場`, `暖身場`; section headings `未來 7 天`, `現在天氣` |
| `--t-body-strong` | 17 / 26 px | 500 | Window line `開放至 22:00（還有 2 小時 40 分）` |
| `--t-body` | 16 / 26 px | 400 | Reason line, annotation, list items, form text, all reading copy |
| `--t-meta` | 16 / 22 px | 400, `--ink-2` | Stamp line, freshness, change-log timestamps |
| `--t-caption` | 13 / 18 px | 500, `--ink-2` | English captions (`Main track`), outlook weekday and date, legend |
| `--t-data` | 28 / 32 px | 600 | Temperature figure in Conditions |

**CJK and bilingual rules**

- `<html lang="zh-Hant-TW">`. Wrap English captions in `<span lang="en">` so screen readers switch voice.
- No italics anywhere: CJK faces fake them badly. Emphasis is weight 600 or 700.
- Letter-spacing 0 for CJK. English captions may use `0.01em`. Never set uppercase English with tracking: it reads as a brand logo.
- Line height is at least 1.5 for multi-line Chinese and 1.25 for single-line display text.
- Use `word-break: normal; line-break: strict;` so punctuation such as `）` and `。` never starts a line.
- Keep full-width punctuation exactly as written in `copy.ts` (`（）`, `：`, `、`). Don't normalise it to half-width.
- Keep the spaces the copy puts between CJK and numbers (`今日 08:00 開放`). Don't add or strip any.

**Numerals:** `font-variant-numeric: tabular-nums` on every element that shows a time, date, duration, temperature, percentage or count. Times are always 24-hour `HH:MM` with a leading zero.

**Minimums:** reading text is never below 16 px, as the spec requires. Only `--t-caption` goes smaller, and only for English captions and compact outlook labels that repeat information shown elsewhere. Respect user font scaling: set sizes in `rem` with `html { font-size: 100%; }` and let the layout grow to 200% zoom without horizontal scrolling.

## 5. Layout, spacing, shape and iconography

The public site is one centred column with a 4 px spacing grid, square-ish corners and no shadows. Structure comes from borders, whitespace and the lane-line rules.

**Spacing scale** (4 px base)

| Token | Value | Typical use |
| --- | --- | --- |
| `--s-1` | 4 px | Icon-to-label gap; between lines inside a venue row |
| `--s-2` | 8 px | Admin field groups; chip rows |
| `--s-3` | 12 px | Disc-to-text gap; chip padding |
| `--s-4` | 16 px | Page side padding on mobile; card padding |
| `--s-5` | 24 px | Between sections; card padding on desktop |
| `--s-6` | 32 px | Above section headings |
| `--s-7` | 48 px | Above the footer |

**Page frame**

- Public content column: `max-width: 640px`, centred, `padding-inline: 16px`. On wide screens see section 9.
- Admin content column: `max-width: 1120px`, `padding-inline: 16px` (mobile) or `24px` (desktop).
- Respect safe areas: `padding-inline: max(16px, env(safe-area-inset-left))`, and the same at the bottom for sticky admin bars.

**Shape and depth**

| Token | Value | Use |
| --- | --- | --- |
| `--r-card` | 12 px | Light card, section cards, admin cards |
| `--r-control` | 8 px | Buttons, inputs, chips |
| `--r-pill` | 999 px | Outlook dots, state chips |
| Border | 1 px `--line` | Every card and input. No shadows anywhere |
| Lane-line rule | 2 px `--line-strong` | Under SiteHeader; between 主場 and 暖身場 rows |
| Status edge | 6 px status fill, inset on the leading edge | Each venue row |
| Focus ring | 3 px `--brand`, offset 2 px, `:focus-visible` only | Every interactive element |

**Iconography**

- Inline SVG only, on a 24 px grid with 2 px strokes, round caps and joins, `fill: none` and `stroke: currentColor`. Icons are drawn once in an `<svg><symbol>` sprite inside the HTML, so they cost no requests.
- **Status glyphs** are the one exception. They are bold symbols drawn white or dark inside the solid disc: ✓ check, ½ half-filled circle, ✕ cross, ? question mark. Stroke 3 px at 48 px, and 2 px at the 20 px outlook size.
- **Inferred confidence:** the disc gets a 2 px dashed outer ring in the same fill colour, offset 3 px. Confirmed and human-verified discs have no ring. **Addition** (makes principle 3 visible without words).
- Utility icons, all 20 px: refresh (重新整理), external link (after every new-tab link, with `aria-hidden` and visually hidden "（另開新分頁）" text), map pin, warning triangle (banners, typhoon), clock (window line), info (annotation `註：`), shield-check (human-verified stamp).
- Don't use sports icons, runner silhouettes or stadium drawings.

## 6. Component library

Build each component once, in one CSS file. Admin reuses the public components, especially VenueRow in the A1 preview and the A2 live preview, so the curator sees exactly what runners will see.

### 6.1 VenueRow, the hero component

One row per venue inside the DualLightCard. Its anatomy, top to bottom:

1. **Status edge:** 6 px bar on the leading edge, full row height, in `--status-*-fill`.
2. **Head line:** a 48 px disc with its glyph on the left. To its right, separated by 12 px, the venue label `主場` (`--t-venue`) with `Main track` (`--t-caption`) beside it on the same baseline. Below that is the state word (`--t-state`, in `--status-*` text colour).
3. **Window line:** clock icon + phase copy, in `--t-body-strong`, `--ink`. Hidden for `unknown`, which shows `目前沒有資料涵蓋今日` in `--ink-2` instead.
4. **Reason line:** `--t-body`, `--ink`. Clamped to 2 lines with `-webkit-line-clamp: 2` on P1 only. The full text appears in today's outlook details row and in the A1/A2 previews. **Addition**, so a 60-character reason can't push 暖身場 below the fold.
5. **Annotation line:** info icon + `註：{text}`, `--t-body`, `--ink-2`. Clamped to 1 line on P1, full text in the previews.
6. **Last-known line** (unknown only): `最後已知：…` in `--status-unknown`.
7. **Stamp line:** `--t-meta`, `--ink-2`. A shield-check icon for human-verified. The link (`查看公告` and the others) is `--brand` with an external icon, and gets `padding-block: 12px` so its tap area reaches 44 px.

Lines 3–7 align to the text column, indented 60 px (48 px disc + 12 px gap). The row padding is 16 px, and the row has no tap action. The `aria-label` sits on the disc wrapper: `主場：開放`.

### 6.2 Public components

| Component | Anatomy and style | States |
| --- | --- | --- |
| **SiteHeader** | At least 56 px tall. Title `臺北田徑場開放燈號` (`--t-title`) over `Taipei Track Status` (`--t-caption`). On P1, a right-aligned block shows the date label `11/6（五）` and `頁面更新 06:12 · 重新整理`. 2 px lane-line rule below | P1 (date + refresh) vs P2–P5 (title links to `/`) |
| **StaleBanner** | Full-width bar under the header. Warning icon, copy, `重新整理` link. 12 px × 16 px padding, 1 px border in the status fill, `role="status"`. Not dismissible | Amber (E-02, E-04): partial tint and text. Red (E-03): closed tint and text |
| **DualLightCard** | `--surface` card with `--r-card` and 1 px border. Two VenueRows split by a 2 px lane-line rule. Never collapses to one row | All 16 claim combinations |
| **DisclaimerLine** | Directly under the card. `--t-meta`, `--ink-2`, info icon, `非官方資訊，出發前請再確認。` + `官方公告` link. No background, never dismissible | Single state |
| **OutlookStrip** | 7 equal columns, each an `<a>` at least 44 px wide and 96 px tall. Weekday `五` + `11/6` (`--t-caption`), then two 20 px dots stacked 8 px apart (top 主場, bottom 暖身場), each holding its glyph. Today's column has a 2 px `--ink` outline and `今天` instead of the weekday. Legend under it: `上：主場　下：暖身場` | Normal. M-03 single grey day. M-04 all grey + line. Stale: all grey |
| **OutlookDetails** | Native `<details>` with summary `查看每日原因` and a chevron that rotates 90°. Seven rows separated by 1 px rules: date (tabular), then two mini state chips with their reasons | Open/closed (native). `:target` row gets a `--status-unknown-tint` background, with no animation |
| **StateChip** | Pill, 28 px tall, 12 px side padding, 14 px glyph + label, `--status-*-tint` background, `--status-*` text | Four states. Used in OutlookDetails, recent changes, admin |
| **ConditionsBlock** | Section card. Top row: temperature in `--t-data` + humidity. Second row: `降雨機率 20%` + AQI chip. Footer in `--t-meta`: `{as_of} 觀測 · 中央氣象署、環境部` | Normal. Typhoon badge on. E-06 block removed. E-07 AQI chip removed. No placeholder |
| **PracticalStrip** | `<dl>` with 4 rows (入口, 票價, 保留跑道, 夜間照明): term in `--ink-2`, value in `--ink`. Then a full-width secondary button `在 Google 地圖開啟` with a map-pin icon | Normal. M-02 section removed |
| **RecentChangeItem** | Line 1: `11/5 18:04 · 主場` in `--t-meta`. Line 2: from-chip → to-chip. Line 3: cause + `來源` link | Normal, override (`人工覆寫`, no link), M-01 empty |
| **SiteFooter** | `--t-meta` links stacked on mobile and inline on desktop, separated by `·`. Each link is a 44 px row. Legal line below in `--t-caption` | Single state |
| **Button** | 48 px tall, `--r-control`, 600 weight. **Primary:** `--brand` fill, `--brand-ink` text. **Secondary:** `--surface` with 1 px `--ink` border. **Text:** `--brand` text, no border, 44 px tap height | Hover: 8% ink overlay. Active: 12%. Disabled: 40% opacity + `aria-disabled`. Busy: spinner + `發布中…` |
| **Link** | `--brand`, underlined with 1 px and 3 px offset. Visited is the same colour. External links get the external icon | Focus ring per section 5 |

### 6.3 Admin components

| Component | Anatomy and style | States |
| --- | --- | --- |
| **AdminTopBar** | `--admin-bar` background, white text, 56 px. `管理後台` left, email in 70% white right. Nav row below it on `--surface`: wrapping links, current page in bold with a 2 px `--brand` underline | One state |
| **Flash** | Under the nav bar, full width, 1 px border, icon + text. Info and success use `--brand` border and icon. Warning uses partial tint. Error uses closed tint. Clears on next navigation | info, success, warning (E-16, E-17), error (E-15, E-20) |
| **AlertCard** | `--surface`, 6 px leading edge in `--status-closed-fill`, warning icon, time in `--t-meta`, one-line cause, `查看` text button right-aligned | Open. M-06 shown as a single neutral line |
| **ClaimRadioTiles** | Four stacked 56 px tiles, each with a disc, label and 2 px border when selected (in the state's fill colour). The native radio stays visually hidden but focusable | Unselected, selected, focus, error |
| **SegmentedRadio** | For `場地` and `類型`. Equal-width 48 px segments, selected one filled `--ink` with white text | Same as above |
| **FormField** | Label (16 px, 600) above the control. Help or counter on the right (`23/60`). Control is 48 px tall with 1 px `--line` border, which becomes 2 px `--brand` on focus. Error text in `--status-closed` with an icon under the field | Default, focus, filled, error, disabled |
| **LivePreview** | A real VenueRow in a dashed `--line-strong` frame labelled `公開頁面預覽`. Shows the reason **unclamped** plus a caution line when it would clamp on P1: `首頁會截斷為 2 行` | Updates on every input |
| **StickyActionBar** | Mobile only, on A2 and A5: fixed to the bottom, `--surface` with a top 1 px border, safe-area padding, primary button full width (`發布` / `儲存`) and a text `取消` | Default, busy, disabled |
| **SourceCard** | Name + state chip on line 1, URL (truncated in the middle) on line 2, fetch metadata in `--t-meta`, actions as text buttons. Inline mute panel expands below inside the card | `正常`, `降級`, `已靜音`, `已停用` |
| **DataTable** | A5 and A6 on desktop: 1 px row rules, 48 px rows, sticky header, tabular numerals. On mobile each row becomes a card (section 9) | Rows, empty (M-07, M-08), paging |
| **ResultChip** | StateChip shape. `相符` uses open tint, `錯誤紅燈` partial tint, `錯誤綠燈` closed fill with white text (the loudest chip in the product) | Four values incl. blank |

## 7. Public Home screen (P1) structure

P1 is one vertical scroll in a fixed order, with the answer zone (elements 1–4) fitting inside 640 px even in the worst case. Below the fold is a planning zone, then a reference zone. Nothing is hidden behind tabs or menus.

**Mobile wireframe, 360 × 640** (closed main track, open warm-up track, delayed banner)

```text
┌── 360 px ──────────────────────────────────────┐
│ 臺北田徑場開放燈號          11/6（五）        │  1 SiteHeader
│ Taipei Track Status    頁面更新 06:12·重新整理 │
╞══════════════════════════════════════╡  lane-line rule
│ ⚠ 本頁 3 小時未更新（最後更新 03:10）… 重新整理 │  2 StaleBanner (only when E-02/03/04)
│                                          │
│ ┌───────────────────────────────────┐ │  3 DualLightCard
│ ┃ (✕)  主場 Main track                  │ │    ┃ = 6 px status edge
│ ┃ 48px 未開放                           │ │    (✕) = 48 px red disc
│ ┃      今日不開放 · 明日 08:00 開放        │ │
│ ┃      全國田徑公開賽 11/6–11/8           │ │    reason, max 2 lines
│ ┃      依場館公告 · 11/2 · 查看公告↗      │ │    stamp
│ ╞═══════════════════════════════════╡ │    lane-line rule
│ ┃ (✓)  暖身場 Warm-up track              │ │
│ ┃ 48px 開放                             │ │    (✓) = 48 px green disc
│ ┃      開放至 22:00（還有 15 小時 48 分）    │ │
│ ┃      依公告開放時間 · 最近查核 06:12 · 查看規定↗│ │
│ └───────────────────────────────────┘ │
│ ⓘ 非官方資訊，出發前請再確認。官方公告↗       │  4 DisclaimerLine
├── fold (640 px) ─────────────────────────┤
│ 未來 7 天                                  │  5 Outlook
│ 今天  六   日   一   二   三   四           │
│ 11/6 11/7 11/8 11/9 11/10 11/11 11/12     │
│  ✕    ✕    ✕    ✓    ✓    ✓    ?    ← 主場  │
│  ✓    ✓    ½    ✓    ✓    ✓    ?    ← 暖身場 │
│ 上：主場　下：暖身場     ▸ 查看每日原因       │
│ [明日燈號變動時通知我]  (v2 only)                 │  9 Subscribe entry
│ 現在天氣   24°C  78%  降雨機率 20%  [■ AQI 48 良好] │  6 Conditions
│ 入場資訊   入口 / 票價 / 保留跑道 / 夜間照明        │  7 Practical
│          [ 在 Google 地圖開啟 ↗ ]             │
│ 最近變動   3 items · 全部變動紀錄 →             │  8 Recent changes
│ 關於本站 · 資料 API · 系統狀態 · 聯絡我們            │ 10 SiteFooter
└───────────────────────────────────────┘
```

The wireframe shows content and order, not exact widths. Reason and stamp lines wrap inside the 60 px text indent.

**Above-the-fold budget** (worst case: banner on, both rows with a 2-line reason and an annotation)

| Element | Height |
| --- | --- |
| SiteHeader (title wraps to 2 lines with date block) + lane rule | 66 px |
| StaleBanner + 12 px gap | 64 px |
| VenueRow × 2: 16 padding + 54 head + 26 window + 52 reason + 26 annotation + 22 stamp + 4 × 4 gaps + 16 padding | 2 × 228 = 456 px |
| Lane rule between rows + card borders | 4 px |
| 8 px gap + DisclaimerLine | 30 px |
| **Total** | **620 px of 640** |

This is why the reason clamps at 2 lines and the annotation at 1 line, and why lines inside a row are 4 px apart. If any token grows, re-run this sum. Section 9 covers what happens at larger text sizes.

**Zones and their visual weight**

| Zone | Elements | Treatment |
| --- | --- | --- |
| Answer | 1–4 | Light card on `--surface`. The only zone with large type and colour |
| Planning | 5 Outlook, 9 Subscribe (v2) | Section card, compact. Dots carry colour at small size only |
| Reference | 6 Conditions, 7 Practical, 8 Recent changes | Section cards in neutrals. No status colour except chips in Recent changes |
| Footer | 10 | No card. `--ink-2` text on `--bg` |

Sections below the fold are separate `--surface` cards with 24 px between them and a `--t-venue` heading inside each.

**State rendering at a glance**

| P1 state | Banner | Light card | Outlook | Rest |
| --- | --- | --- | --- | --- |
| Success | None | Real states | Real dots | Normal |
| Partial data | None | Grey row(s) with the same anatomy | Real + grey dots | Normal |
| Delayed (E-02) | Amber | Unchanged | Unchanged | Normal |
| Stale (E-03) | Red | Both grey, last known shown | All grey | Conditions still shown |
| Wrong day (E-04) | Amber | Snapshot date visible in header | Unchanged | Normal |
| Weather down (E-06/07) | None | Unchanged | Unchanged | Conditions block or AQI chip removed, no gap left |
| No snapshot (E-01) | — | P6 replaces the page: header, E-01 title and body, primary `前往官方公告`, text `重新整理`. No disc anywhere | — | — |

**Other public screens** reuse the same frame. P2 `/history` is a list of RecentChangeItems grouped under sticky date headers `11/5（四）`. P3 `/about` is a reading page with 5 headed sections at `--t-body`, and the four states shown as StateChips. P5 and P6 are centred single-message pages with one primary button.

## 8. Admin dashboard structure (A1–A6)

The admin is a back-office tool for one person on a phone at 06:00, so it is designed around one job: publish a correct override in under 60 seconds. It looks plainer and denser than the public site, and it never hides what the public will see.

**A1 Dashboard layout**

```text
MOBILE (360–767 px), one column, urgency order      DESKTOP (≥ 1024 px), 12-column grid
┌─ 管理後台 ······ curator@… ─┐                    ┌─ 管理後台 ··································· curator@… ─┐
│ 總覽 覆寫 資料來源 對帳 稽核 登出 │                    │ 總覽  覆寫  資料來源  對帳  稽核紀錄  登出                          │
├─ flash ───────────────────┤                    ├─ flash ───────────────────────────────────────────────────┤
│ 1 Alerts (cards)             │                    │ 1 Alerts (full width, only when any are open)           │
│ 2 Public preview (light card)│                    ├─ cols 1–7 ────────────────────────┬─ cols 8–12 ────────────────┤
│ 3 [新增覆寫] [立即重新發布]     │                    │ 2 Public preview             │ 3 Quick actions                │
│ 4 Active overrides (≤ 3)     │                    │   (same VenueRow as P1)      │ 4 Active overrides             │
│ 5 Source health (1 line each)│                    │                              │ 5 Source health                │
└─────────────────────────────┘                    └──────────────────────────────┴────────────────────────────────┘
```

On mobile, `新增覆寫` is a full-width primary button placed directly under the preview, inside thumb reach. The preview is wrapped in a dashed frame labelled `公開頁面預覽`, so it is never mistaken for an editable control.

**Screen-by-screen layout**

| Screen | Layout | Key design decisions |
| --- | --- | --- |
| **A0 Sign-in** | Cloudflare-hosted. Only the custom text is ours | Set copy `此帳號沒有管理權限。` and `已登出。`. Don't try to theme Cloudflare's page |
| **A1 Dashboard** | As drawn above | Ordered by urgency. Alerts use the closed-red edge. Source health is a compact list, not cards |
| **A2 New override** | Mobile: one column, fields in spec order, LivePreview after the last field, StickyActionBar with `發布`. Desktop: form in cols 1–7, LivePreview sticky in cols 8–12 | Type switch is a SegmentedRadio at the top. Claim uses ClaimRadioTiles so the colour preview starts at the moment of choice. `公開原因` shows the counter and the clamp warning |
| **A2 guard dialogs** | Native `confirm()` as specified | Keep native: it can't be styled past, and that is the point |
| **A3 Overrides list** | Three headed groups: `生效中`, `排定中`, `已到期（近 30 天）`. Each item is a card: venue + date range on line 1, claim StateChip + `到期 {M/D HH:MM}` on line 2, reason on line 3, actions as text buttons | Expired group is collapsed in a `<details>` by default. Annotations carry a neutral `註記` chip |
| **A4 Sources** | Stack of SourceCards. Mute opens an inline panel, never a modal | The impact line `靜音後，未來 7 天有 {n} 個場地日會改變燈號。` sits above `確認靜音` in bold. `已停用` cards are greyed with no buttons |
| **A5 Reconcile** | Progress line `連續相符 {n} / 14 天` as a 14-segment bar at the top. Desktop: DataTable. Mobile: one card per venue-day with the select full width. StickyActionBar `儲存` | A false-green alert pins to the top in closed tint. The 14-segment bar uses open-fill for matched days and neutral for the rest |
| **A6 Audit** | Read-only list, newest first. Filter select at top. Each row: timestamp in tabular numerals, actor, action; `<details>` with `payload_json` in `--font-mono` 14 px on `--bg` | Paging buttons `上一頁` / `下一頁` at the bottom, full width on mobile |

**Admin interaction rules**

- Every POST button turns into a disabled busy state (`發布中…`) immediately. The page never looks idle while a write is in flight.
- Flash messages appear at the top and are announced with `role="status"` (success, info) or `role="alert"` (errors).
- Destructive or dangerous actions are text buttons with a confirm. Only `新增覆寫`, `發布` and `儲存` are primary buttons.
- Field errors appear under the field and in a summary at the top, and focus moves to the first invalid field, as the spec requires.
- No tables wider than the viewport on mobile. Anything with more than 3 columns becomes cards below 768 px.

## 9. Responsive behaviour

Design mobile-first at 360 × 640 and treat desktop as the same page with more room, never a different product. DOM order is fixed: the answer zone comes first in the HTML at every width, and CSS Grid only rearranges it visually on wide screens.

**Breakpoints** (min-width, CSS only, no JS)

| Name | Range | Public P1 | Admin |
| --- | --- | --- | --- |
| `xs` | 320–359 px | Side padding drops to 12 px. Disc stays 48 px. Outlook columns shrink to 42 px and the weekday shows only one character | Same as `sm` |
| `sm` (design baseline) | 360–599 px | Single column as in section 7 | Single column, StickyActionBar on A2 and A5, tables as cards |
| `md` | 600–1023 px | Single column, max 640 px, centred. Conditions and Practical sit side by side in two equal cards. Outlook columns grow to 64 px | Single column, max 720 px. Tables return at 768 px and up. StickyActionBar is replaced by an inline button row |
| `lg` | ≥ 1024 px | Two columns in a 1040 px frame. Left (5/12): answer zone, `position: sticky; top: 24px`. Right (7/12): Outlook, Conditions, Practical, Recent changes. Footer spans both | 12-column grid. A1 and A2 split as drawn in section 8 |

**Type and spacing at `lg`:** `--t-state` 28/34 px, `--t-title` 22/30 px, disc 56 px, card padding 24 px. Everything else keeps its mobile size, because reading distance on a laptop is similar.

**Desktop P1 sketch**

```text
┌── 1040 px frame ───────────────────────────────────────────────────────────────┐
│ 臺北田徑場開放燈號  Taipei Track Status            11/6（五） 頁面更新 06:12 · 重新整理 │
╞════════════════════════════════════════════════════════════════╡
│ [StaleBanner, full width, when present]                                         │
│ ┌─ answer zone (sticky) ─────┐  ┌─ 未來 7 天 ────────────────────────────────┐ │
│ │ (✕) 主場  未開放              │  │  7 wide columns, details below            │ │
│ │     window · reason · stamp  │  └───────────────────────────────────────────┘ │
│ ╞══════════════════════════════╡  ┌─ 現在天氣 ────────┐ ┌─ 入場資訊 ──────────┐ │
│ │ (✓) 暖身場 開放              │  │                    │ │                      │ │
│ │     window · stamp           │  └────────────────────┘ └──────────────────────┘ │
│ └──────────────────────────────┘  ┌─ 最近變動 ─────────────────────────────────┐ │
│ ⓘ 非官方資訊… 官方公告↗          │  3 items · 全部變動紀錄 →                    │ │
│                                 └───────────────────────────────────────────┘ │
│ 關於本站 · 資料 API · 系統狀態 · 聯絡我們 · 本站為個人專案，與臺北市政府體育局無關。             │
└───────────────────────────────────────────────────────────────┘
```

**Edge conditions**

- **Large text** (200% zoom, iOS Dynamic Type XXL): the fold budget no longer holds, and that is acceptable. Never shrink text or hide the reason to protect it. The state words must still be the first thing in reading order and must still appear in the first screen.
- **Landscape phones** (height around 360 px): accept scrolling. Keep the header from becoming sticky, so it doesn't eat the viewport.
- **Pointer vs touch:** hover styles only inside `@media (hover: hover)`. Every hover effect has a focus-visible equivalent.
- **Sticky elements:** only the `lg` answer zone and the admin StickyActionBar. No sticky public header, no floating buttons.
- **Orientation and resize** never trigger JS layout. The inline script only rewrites window-line text and banner visibility.

## 10. Motion, accessibility and performance

The public page is effectively motionless, meets WCAG 2.2 AA, and treats its byte budget as a visual constraint. These are requirements, not polish.

**Motion**

| Where | Allowed motion | Not allowed |
| --- | --- | --- |
| Public pages | None, apart from the native `<details>` toggle and a 90° chevron rotation in 150 ms | Pulsing or glowing lights, count-up numbers, skeleton loaders, slide-in banners, scroll effects, page transitions |
| Window-line updates (every 30 s) | Text swaps instantly. No `aria-live` on the window line, so screen readers aren't interrupted twice a minute | Any animation of the change |
| Admin | 150 ms colour and border transitions on controls, a spinner on busy buttons, the inline mute panel opening in 150 ms | Toasts that fly in, modals other than native `confirm()` |
| All | `@media (prefers-reduced-motion: reduce)` sets every transition to 0 ms and replaces the spinner with static `發布中…` text | — |

**Accessibility checklist** (on top of the spec's acceptance criteria)

- Landmarks: `<header>`, `<main>`, `<footer>`. The light card is `<section aria-labelledby>` with a visually hidden `<h2>今日燈號</h2>`.
- Heading order: one `<h1>` (site title), `<h2>` per section. Venue labels are `<h3>`.
- Each disc wrapper carries the spec's `aria-label` (`主場：開放`). The glyph SVG is `aria-hidden`.
- Confidence must be in the text, not only in the dashed ring: the stamp copy already says `由賽程推估`, so keep it visible.
- StaleBanner uses `role="status"`. Admin errors use `role="alert"`.
- Outlook columns: each `<a>` has an `aria-label` like `11/7（六）主場未開放，暖身場開放`.
- External links carry visually hidden `（另開新分頁）`.
- Contrast: text 4.5:1 and graphics 3:1, already met by the palette in section 3. Re-check any new colour with a script, not by eye.
- Keyboard: all actions reachable by Tab, visible focus ring, no focus traps. The A2 type switch and claim tiles work with arrow keys as native radios.
- Test with VoiceOver (iOS, zh-TW voice), TalkBack, 200% zoom, greyscale and Windows forced colours.

**Performance as a design budget**

| Budget | Limit | Design consequence |
| --- | --- | --- |
| P1 HTML, gzipped | < 20 KB | Copy is short. No inline images. The SVG sprite holds about 12 symbols |
| CSS, gzipped | Target < 8 KB, one file | One component layer, no utility framework |
| Requests | HTML + CSS only | System fonts, inline SVG, no favicon request beyond an inline data-URI SVG |
| JS | One inline script, ≤ 40 lines | All visuals must be correct with JS off. JS only rewrites the window line and banner |
| First meaningful paint | < 1.5 s on 4G | Answer zone has no dependency on anything below it |
| Third parties | Zero on public pages | Google Maps is a plain link, never an embed. No analytics pixel, no font CDN |

## 11. Visual references

Borrow the *pattern* from each reference, never its branding, colours or logo. The closest single analogue is a Japanese railway operation-status page: one row per line, one state word, a reason line and an update time.

| Reference | Borrow | Leave behind |
| --- | --- | --- |
| **Japanese railway operation-status pages** (運行情報, e.g. JR East) | One row per line, a single state word, a one-sentence cause, and a visible "as of" time. The closest model for the light card | Dense multi-line tables and the operator's corporate colours |
| **Airport and rail departure boards** (split-flap style) | Tabular numerals, one-word statuses, rows that never change position | Black-and-yellow skin, animation of flipping characters |
| **Taipei Metro bilingual wayfinding** | zh large, en small beneath; plain sans; clear hierarchy | Line colours and the Metro logo, which would imply an official source |
| **Service status pages** (Atlassian Statuspage, GitHub Status) | Per-component states, a strip of daily status bars (becomes the 7-day outlook), an incident history (becomes the change log) | SaaS marketing headers, uptime percentages, subscribe pop-ups |
| **GOV.UK Design System** | Notification banners, error summary at the top of forms, plain-language copy, generous form controls (admin A2) | GOV.UK typeface and crown branding |
| **Ski resort lift-status boards** | Open / closed per lift, with today's hours under each | Snow photos and promotional imagery |
| **Taiwan's 2020 mask-availability maps** (g0v civic-tech projects) | A single-purpose civic utility, Traditional Chinese first, unofficial but trusted because it links its sources | Map-first layouts; this product has no map |
| **CWA weather app and iOS Weather** | A compact current-conditions row: big temperature, small supporting figures | Animated weather backgrounds |

**Anti-references** (the look to avoid): running and fitness apps with neon gradients and achievement badges; city-government portals with banner carousels and dense menus; booking systems with calendars and "reserve" buttons, which would suggest a reservation exists.

**Mood board instruction for the builder:** if you generate any reference imagery, describe it as "bilingual public status board, flat, white paper, black ink, one green-red signal disc per row". Don't generate photos of the actual stadium, and don't put any reference image in the shipped site.

## 12. Builder handoff

Paste this token file as `src/styles/tokens.css`, build the components in the order listed, and tick the checklist before calling any screen done.

**`tokens.css`**

```css
:root {
  color-scheme: light dark;
  /* neutrals */
  --bg: #F6F7F8; --surface: #FFFFFF; --ink: #16191D; --ink-2: #4A525C;
  --line: #D5D9DE; --line-strong: #AEB5BD;
  --brand: #1F4FD1; --brand-ink: #FFFFFF; --admin-bar: #16191D;
  /* status: text / fill / glyph / tint */
  --status-open: #13753C;    --status-open-fill: #1E8E4A;    --status-open-glyph: #FFFFFF;    --status-open-tint: #E7F4EC;
  --status-partial: #8F5200; --status-partial-fill: #C27C00; --status-partial-glyph: #16191D; --status-partial-tint: #FDF2DC;
  --status-closed: #C0262D;  --status-closed-fill: #D32F2F;  --status-closed-glyph: #FFFFFF;  --status-closed-tint: #FBE9E9;
  --status-unknown: #5E6670; --status-unknown-fill: #7A828C; --status-unknown-glyph: #FFFFFF; --status-unknown-tint: #EEF0F2;
  /* type */
  --font-sans: -apple-system, BlinkMacSystemFont, "PingFang TC", "Noto Sans TC", "Noto Sans CJK TC",
               "Microsoft JhengHei", "Segoe UI", Roboto, system-ui, sans-serif;
  --font-mono: ui-monospace, "SF Mono", Menlo, Consolas, monospace;
  --t-state: 700 1.5rem/1.875rem var(--font-sans);
  --t-title: 700 1.25rem/1.75rem var(--font-sans);
  --t-venue: 600 1.125rem/1.5rem var(--font-sans);
  --t-body-strong: 500 1.0625rem/1.625rem var(--font-sans);
  --t-body: 400 1rem/1.625rem var(--font-sans);
  --t-meta: 400 1rem/1.375rem var(--font-sans);
  --t-caption: 500 0.8125rem/1.125rem var(--font-sans);
  --t-data: 600 1.75rem/2rem var(--font-sans);
  /* space, shape */
  --s-1: 4px; --s-2: 8px; --s-3: 12px; --s-4: 16px; --s-5: 24px; --s-6: 32px; --s-7: 48px;
  --r-card: 12px; --r-control: 8px; --r-pill: 999px;
  --disc: 48px; --edge: 6px; --tap: 44px;
}
@media (prefers-color-scheme: dark) {
  :root {
    --bg: #0E1114; --surface: #171B20; --ink: #ECEFF2; --ink-2: #A9B1BA;
    --line: #2C333B; --line-strong: #48515B;
    --brand: #7FA6FF; --brand-ink: #0E1114; --admin-bar: #000000;
    --status-open: #4CC97A;    --status-open-fill: #3DBA6C;    --status-open-glyph: #0E1114;    --status-open-tint: #14281C;
    --status-partial: #F2B544; --status-partial-fill: #E8A93A; --status-partial-glyph: #0E1114; --status-partial-tint: #2E2410;
    --status-closed: #FF7A7A;  --status-closed-fill: #F26363;  --status-closed-glyph: #0E1114;  --status-closed-tint: #311819;
    --status-unknown: #9AA3AD; --status-unknown-fill: #8A939D; --status-unknown-glyph: #0E1114; --status-unknown-tint: #20252B;
  }
}
@media (min-width: 1024px) {
  :root { --t-state: 700 1.75rem/2.125rem var(--font-sans); --t-title: 700 1.375rem/1.875rem var(--font-sans); --disc: 56px; }
}
@media (prefers-reduced-motion: reduce) { * { transition-duration: 0ms !important; animation: none !important; } }
```

Drive each venue row from one attribute, so a state can never be half-applied:

```css
.venue[data-claim="open"]    { --c: var(--status-open);    --c-fill: var(--status-open-fill);    --c-glyph: var(--status-open-glyph); }
.venue[data-claim="partial"] { --c: var(--status-partial); --c-fill: var(--status-partial-fill); --c-glyph: var(--status-partial-glyph); }
.venue[data-claim="closed"]  { --c: var(--status-closed);  --c-fill: var(--status-closed-fill);  --c-glyph: var(--status-closed-glyph); }
.venue[data-claim="unknown"], .venue:not([data-claim]) { --c: var(--status-unknown); --c-fill: var(--status-unknown-fill); --c-glyph: var(--status-unknown-glyph); }
.venue[data-confidence="inferred"] .disc { outline: 2px dashed var(--c-fill); outline-offset: 3px; }
```

The `:not([data-claim])` selector covers a missing claim. Also put the unknown values on the base .venue rule, so an unrecognised value renders grey too, which matches the spec's fail-closed rule in CSS as well as in code.

**Build order**

1. `tokens.css` and a base layer (reset, body type, focus ring, links).
2. VenueRow and DualLightCard, then a static fixture page that renders all 16 claim combinations × 4 confidence levels, in light and dark. Review this page before building anything else.
3. SiteHeader, StaleBanner (both variants), DisclaimerLine, SiteFooter.
4. OutlookStrip and OutlookDetails, then ConditionsBlock, PracticalStrip and RecentChangeItem.
5. P1 assembly, then P2, P3, P5 and P6.
6. Admin chrome, Flash, AlertCard, then A1 and A2 with LivePreview, then A3–A6.
7. P4 Subscribe (v2), behind the flag.

**Design acceptance checklist**

- [ ] Fixture page shows all 16 combinations with equal row heights for equal content, in both themes.
- [ ] Worst-case P1 (banner + 2-line reasons + annotations) keeps both state words, both window lines and the disclaimer inside 360 × 640.
- [ ] Greyscale screenshot of P1 still shows which venue is open, using glyphs and words alone.
- [ ] No green, amber or red pixel appears on a normal open day except the open discs, edges, words and outlook dots.
- [ ] Inferred status shows the dashed ring and the `由賽程推估` stamp. Confirmed and human-verified show no ring.
- [ ] Every text/background pair passes 4.5:1, and every disc passes 3:1 against `--surface`, checked by script.
- [ ] All tap targets measure at least 44 × 44 px, including stamp links, outlook columns and footer links.
- [ ] Reason line clamps at 2 lines on P1 only. A2 preview shows full text plus the clamp warning.
- [ ] At `lg`, the answer zone is sticky in the left column and DOM order is unchanged.
- [ ] Admin top bar is ink-coloured on every admin screen. No admin component appears on public pages.
- [ ] No web fonts, images, icon fonts, gradients, shadows or animations beyond section 10's list.
- [ ] Every visible string comes from `src/copy.ts`; this brief's example strings are illustrations only.

**Open design questions for @Katoku**

- Does the operator publish an official venue name in English? If so, replace `Main track` and `Warm-up track` with it.
- Should P2 `/history` get a simple venue filter later? It's out of v1, but the layout leaves room for a SegmentedRadio under the heading.
