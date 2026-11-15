# Source discovery

Phase 1 spike, 2026-11-15. Answers the TRD's open technical questions.
Everything marked **Checked** was read in a browser on that date. Everything
marked **Not checked** is a candidate from memory or from the specs and must be
confirmed before it is used. No file was downloaded and nothing was fetched by
a script.

## Headline findings

1. **The operator publishes a monthly activity table for both tracks, as two
   separate PDFs.** The Sports Department's 活動訊息 listing carries one post
   per month titled `{民國年}年{月}月臺北田徑場主場及暖身場活動一覽表`. The
   November post (published 115-10-28) attaches one PDF for 暖身場 and one for
   田徑場 (主場). This answers the TRD's second open question: the two tracks
   are announced separately, so the dual light is supportable from parsed data.
2. **The detail is PDF-only.** The post body holds nothing but the title and
   the two attachments. The TRD's first open question is therefore answered
   the hard way: closures appear inside PDFs, not in an HTML listing. The
   external PDF job (TRD decision #9) moves from "phase 3+" to the critical
   path of Phase 6.
3. **A machine-readable listing exists.** The 活動訊息 listing has an RSS feed
   whose items include the attachment links. The ingest job can poll the feed
   (small XML) and open a PDF only when its link changes.
4. **The PDFs are revised mid-month.** The attachment file names carry a
   revision date: `115.10.29暖身場115年11月活動一覽表.pdf` and
   `115.11.10田徑場115年11月活動一覽表.pdf`. The main-track table was replaced
   on 11/10, after the post date. The attachment URL changes when the file is
   replaced, which is the change signal.
5. **Lead time is short at the start of a month.** The November table was
   posted on 10/28, three days before the month began. On the last days of a
   month the 7-day outlook will be mostly `unknown` unless the next table is
   already out. This bears on decision D-7.
6. **The 最新消息 listing carries no track closures.** Its 20 newest items
   (9/1 to 11/13) are tenders, recruitment and general notices. It is not a
   useful rank-2 source.

## Inside the PDFs (read 2026-11-15, with Katoku's approval)

Both November files were read: `115.11.10田徑場115年11月活動一覽表.pdf`
(主場, 85 KB) and `115.10.29暖身場115年11月活動一覽表.pdf` (暖身場, 132 KB).

**Format.** One page each, real text (not a scan), one table with four
columns: `項次`, `檔期名稱`, `日期`, `檔期地點及開放時段`. The title is
`臺北田徑場 115 年 11 月份田徑場檔期一覽表` (or `暖身場`), so the venue and
the ROC year and month come from the title. The revision date is printed at
the bottom (`115.11.10`).

**Each row states public access explicitly.** The last column is one of:

- `全天暫停開放`: closed to the public all day.
- `開放時段：0500-0900,1700-2200` plus `暫停開放：0900-1700`: the open and
  closed windows for that day, as `HHMM-HHMM` lists.

So this source gives closures and open windows directly, not just an activity
list. Facts from it can be `confirmed`, and the event name is the reason.

**Regular hours are in note 3 of each file, and they differ from the specs.**

| Venue  | Regular public hours (no event)                 | Spec assumption |
| ------ | ----------------------------------------------- | --------------- |
| 主場   | 05:00–09:00 and 18:00–22:00 (two windows a day) | 08:00–22:00     |
| 暖身場 | 05:00–23:00                                     | 08:00–22:00     |

A date that is not listed in the table follows these regular hours.

**Row and date shapes seen.**

- Single day `11/3 (二)` and ranges `11/14 至 15 (六至日)`, `11/23 至 30 (一至一)`.
- Up to two open windows and two closed windows in one day.
- One row can hold two events (`11/14`, 暖身場).
- Stray trailing commas (`暫停開放：0800-1200,`) and an event name that
  embeds a time range (`臺北市 5000 公尺挑戰賽(1500-2200)`).
- Event names wrap across lines inside a cell.

**Caveats printed on the document.**

- `本表僅供參考`: the table is for reference; the booking system's approved
  slots are authoritative.
- Changes are announced by replacing the posted notice. The online file was
  replaced once this month (11/10).
- If an event ends early, the track reopens early. A parsed `closed` can
  therefore be a false red, never a false green.

**What November looks like.** 主場 is closed all day on 11/1, 11/14–15,
11/18–22 and 11/23–30, and partly open on 11/3, 11/4, 11/11, 11/13 and 11/17.
暖身場 is closed all day from 11/14 to 11/30. Activity is far heavier than the
PRD's "several times a month".

## What is still unknown

- **Whether the format is stable month to month.** Only November was read.
  Earlier months are no longer on the listing.
- **Ad-hoc closures** (typhoon, maintenance, requisitions). No online source
  was found for these. They stay with the curator override.

## Sources

| #   | Source                                | URL                                                                           | Format                                                 | robots.txt                                                                 | Status                                                                                                                                                         |
| --- | ------------------------------------- | ----------------------------------------------------------------------------- | ------------------------------------------------------ | -------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | 活動訊息 RSS (Sports Department)      | `https://sports.gov.taipei/OpenData.aspx?SN=2D58889BB41F75D7`                 | RSS 2.0 XML, items link the PDFs                       | No robots.txt (HTTP 404), so nothing is disallowed                         | **Checked.** Recommended primary source                                                                                                                        |
| 2   | 活動訊息 listing (HTML)               | `https://sports.gov.taipei/News.aspx?n=E216AB320D1BDFF5&sms=9D72E82EC16F3E64` | HTML table, 2 items at the time                        | Same host as 1                                                             | **Checked.** Fallback for 1; also the public `官方公告` link target                                                                                            |
| 3   | Monthly activity PDFs                 | `https://www-ws.gov.taipei/Download.ashx?u=…` (linked from 1 and 2)           | PDF, about 83 KB and 129 KB                            | No robots.txt (HTTP 404)                                                   | **Checked.** November files read; see the section above                                                                                                        |
| 4   | 最新消息 listing                      | `https://sports.gov.taipei/News.aspx?n=77C9A2195D46E1A9&sms=78D644F2755ACCAA` | HTML table, RSS at `OpenData.aspx?SN=FFA3D5C692B4849A` | Same host as 1                                                             | **Checked.** No closures found; do not ingest                                                                                                                  |
| 5   | 臺北體育園區 regulations              | `https://laws.gov.taipei/law/File/0000181221` (from the PRD)                  | Not checked (likely PDF)                               | robots.txt allows `/`; the disallowed paths do not cover `/law/File/`      | Not needed for v1: regular hours are printed in the monthly PDFs. Document **not checked**                                                                     |
| 6   | 中華民國田徑協會 competition calendar | Host `www.athletics.org.tw`; calendar URL not found yet                       | Not checked                                            | No robots.txt (HTTP 404)                                                   | robots **checked**, calendar **not checked**                                                                                                                   |
| 7   | 場館租借 system                       | `https://vbs.sports.gov.taipei/`                                              | Web app                                                | Empty robots.txt                                                           | **Out of scope.** The PRD forbids scraping the booking system. Not to be added to the allowlist                                                                |
| 8   | Venue open data                       | `https://data.gov.tw/dataset/137770` (from the PRD)                           | CSV, updated yearly, 政府資料開放授權條款 第1版        | robots.txt returned HTTP 500 on the day; retry before use                  | **Checked.** Fields are name, operator, phone, address, longitude and latitude only. It has no fees, hours or entrances, so it cannot fill the practical strip |
| 9   | CWA open data                         | `https://opendata.cwa.gov.tw`                                                 | REST + API key                                         | API with key; terms at `https://opendata.cwa.gov.tw/about/rule` (not read) | Dataset pages **checked**, see below. API not called (no key yet)                                                                                              |
| 10  | MOENV air quality                     | `https://data.moenv.gov.tw`                                                   | REST + API key                                         | API with key; terms not read                                               | Dataset `AQX_P_432` page **checked**. API not called (no key yet)                                                                                              |

Site terms: the Sports Department site links a 政府網站資料開放宣告 at
`https://sports.gov.taipei/ct.asp?xItem=112618041&ctNode=33073&mp=104061`.
**Read 2026-11-15.** It licenses everything on the site for free,
non-exclusive, sublicensable reuse, including copying, adapting and building
services on it, with no need to ask. Three conditions apply to this project:
state the source, do not alter the information so that it misleads, and do not
use the department's logo. The licence also says it does not imply the
department's endorsement, which matches the `非官方資訊` line.

## Effect on the build

| Topic                            | Spec assumption                         | What was found                                                      | Proposed change                                                                                                                                                                                                     |
| -------------------------------- | --------------------------------------- | ------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Rank-2 source                    | An HTML notice listing with closures    | No such listing; a monthly PDF per venue                            | Source 1 (RSS) becomes the listing, with one `document_key` per PDF. Facts come from the PDF job                                                                                                                    |
| Confidence of those facts        | `confirmed` for venue notices           | Each row states the open and closed windows                         | `confirmed`, with the event name as the reason                                                                                                                                                                      |
| **Open windows per day**         | One window `[start, end]` per venue-day | 主場 has two windows on a normal day, and event days have up to two | **Change the type, the schema and the copy to a list of windows.** Affects `VenueDay`, `fact`, `override`, `hours_rule`, `venue_day`, `status.json`, the phase table and the A2 form. Needs Katoku's approval (D-8) |
| Regular hours (rank 4)           | 08:00–22:00 from the regulations page   | Printed in note 3 of each PDF, per venue                            | Take `hours_rule` from the PDF itself. The regulations source may not be needed                                                                                                                                     |
| Which claim a normal 主場 day is | `open`                                  | Open 05:00–09:00 and 18:00–22:00, shut in between                   | Decide whether this reads as `開放` with two windows or `部分開放` (D-9). Recommendation: `開放`, since it is the regular schedule                                                                                  |
| PDF parsing                      | Later, for detail only                  | It is the main path, and the files are small text PDFs              | Build `jobs/pdf-parse/` first in Phase 6. Text extraction is enough; no OCR                                                                                                                                         |
| Warm-up track (D-3)              | May never be named separately           | It has its own PDF with its own windows                             | D-3 is settled: the dual light is fully supported                                                                                                                                                                   |
| Outlook length (D-7)             | 7 days if lead time is long             | Lead time is 3 days at month start, about 30 days mid-month         | Keep 7 days; expect `unknown` dots across a month boundary                                                                                                                                                          |
| Competition calendar             | Main source of lead time                | The operator's own table already lists activities                   | Not needed for v1; the operator's table already covers it                                                                                                                                                           |

## Constants and datasets

- Stadium address: 臺北市松山區敦化北路 3 號 (from the PRD).
- Coordinates: 25.04944 N, 121.55111 E, from the Chinese Wikipedia article
  for 臺北田徑場. Cross-check against dataset 137770 before Phase 6.
- CWA observations (temperature, humidity): `O-A0003-001`,
  氣象觀測站-10分鐘綜觀氣象資料. **Checked** on the catalogue page. Which
  station is nearest is **not checked**; it needs one API call with a key.
- CWA rain probability: `F-D0047-061`, 鄉鎮天氣預報-臺北市未來3天天氣預報,
  with `PoP6h` and `PoP12h`, updated every 6 hours. **Checked.** Use the
  松山區 entry.
- CWA typhoon flag: **unresolved.** `W-C0034-005` is the tropical cyclone
  track dataset, not a warning for Taipei. A land-warning dataset still has to
  be found, and the operator's typhoon rule is unknown. Until both are known,
  the weather modifier stays off and typhoon closures go through the override.
- MOENV air quality: `AQX_P_432`, 空氣品質指標(AQI), hourly, with `SiteName`,
  `AQI`, `Status`, `Longitude` and `Latitude`. **Checked.** The nearest
  station is **not checked** (probably 松山); pick it by distance from the
  coordinates above once a key exists.
- Practical strip (entrance, fee, reserved lanes, floodlight hours): no
  machine-readable source found. A related dataset,
  臺北市政府體育局開放式運動場地開放時間及收費基準表, may cover hours and
  fees and is **not checked**. Otherwise this content is hand-written.
- Operator venue names as seen in the post title: `臺北田徑場主場` and
  `暖身場` (the PDF file names say `田徑場` and `暖身場`).

## Draft email to the operator (not sent; Katoku sends it)

> 主旨：請教臺北田徑場主場及暖身場開放資訊之公開資料
>
> 臺北市政府體育局 您好：
>
> 我是一名常在臺北田徑場練習的市民，正在製作一個非官方、非營利的個人網頁，
> 用來整理貴局每月公布的「臺北田徑場主場及暖身場活動一覽表」，讓跑者出門前
> 能快速確認當天是否開放。網頁只會連結貴局的原始公告，不轉載檔案，並會清楚
> 標示為非官方資訊。
>
> 想請教三件事：
>
> 1. 活動一覽表所列的活動時段，是否代表該時段場地不對一般民眾開放？或是
>    仍有部分跑道開放？
> 2. 臨時性的休館（例如颱風、場地整修、臨時借用）是否有固定的線上公告位置？
> 3. 貴局是否有提供機器可讀的開放資訊（例如開放資料或智慧場館系統的介接）？
>
> 本網頁每小時最多讀取貴局網站一次。如貴局希望調整讀取方式或停止讀取，
> 請來信告知，我會在 48 小時內處理。
>
> 謝謝您撥冗回覆。
>
> {姓名}
> {聯絡信箱}

## Needs Katoku

- [x] Approve opening the two November PDFs so their structure can be recorded.
- [ ] Decide D-8 (a list of open windows per day) and D-9 (how a normal 主場
      day reads). Both must be settled before Phase 3 writes the schema.
- [ ] Confirm the finding that the two tracks are announced separately
      (Phase 1 exit gate).
- [ ] Send the operator email, or edit it first.
- [ ] Start the daily entries in `docs/source-log.md`.
