# Incident: <short title>

A false green is an incident, not a bug. Copy this file to
`incidents/YYYY-MM-DD-<slug>.md` and fill in every section.

- **Date (Taipei):**
- **Venue:** 主場 / 暖身場
- **What the page showed:** claim, confidence, stamp, at 06:00 and 18:00
- **What was actually true:**
- **How it was found:** reconciliation / runner report / other
- **Kind:** false green / false red / other

## Timeline

Taipei time. Include the fetch runs and publish runs involved.

## Root cause

Which input (fact, override, hours rule, mute, weather) decided the status, and
why that input was wrong. Link the `fetch_run` id and the R2 key.

## Fix

- [ ] Golden fixture added in `fixtures/resolver/` reproducing the case
- [ ] Resolver, parser or source rank changed
- [ ] Alert on A1 marked `標示已處理`

## What would have caught it earlier
