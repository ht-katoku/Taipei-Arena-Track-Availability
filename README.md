# Taipei Track Status Board (臺北田徑場開放燈號)

One URL that answers one question: can I run on the Taipei Athletics Stadium
track today, main track or warm-up track? Unofficial, read-only, no accounts.

The six spec documents in the repo root are the source of truth. The
Implementation Plan sets the build order; `docs/decisions.md` records every
ruling made along the way.

## Status

Phase 1 (setup) in progress. See `docs/sources-discovery.md` for the source
questions that must be confirmed before Phase 6.

Preview: <https://tsb-web-preview.taipei-track-status.workers.dev> (placeholder
page with the security headers, first deployed 2026-11-15).

## Local development

Requires Node 22 or later.

```bash
npm install
```

```bash
npm run typecheck
```

```bash
npm run lint
```

```bash
npm test
```

```bash
npm run dev:web
```

Copy `.dev.vars.example` to `.dev.vars` for local secrets. Never commit real
values.

## Layout

```text
src/shared/     time.ts  types.ts  schemas.ts  copy.ts  sources.ts
src/resolver/   resolve.ts  weather.ts
src/ui/         Hono JSX components, tokens.css, base.css
src/db/         hand-written SQL, one file per table group
src/adapters/   one parser per source
src/web/        public read path helpers
workers/        web/  admin/  ingest/  publish/   (index.ts + wrangler.jsonc each)
migrations/     core/  push/ (v2)
fixtures/       payloads/  resolver/  snapshots/
tests/  e2e/  scripts/  jobs/pdf-parse/  incidents/  docs/  .github/workflows/
```

Folders appear as the phase that fills them lands.

## Dependencies

Target: fewer than 15 direct dependencies, each justified here.

| Package                     | Kind | Why it is needed                              |
| --------------------------- | ---- | --------------------------------------------- |
| `typescript`                | dev  | Strict typing everywhere                      |
| `wrangler`                  | dev  | Local dev, D1 migrations and Workers deploys  |
| `@cloudflare/workers-types` | dev  | Types for the Workers runtime and bindings    |
| `vitest`                    | dev  | Unit, fixture and constraint tests            |
| `eslint`, `@eslint/js`      | dev  | Lint, including the ban on raw HTML injection |
| `typescript-eslint`         | dev  | TypeScript parser and rules for ESLint        |
| `prettier`                  | dev  | Formatting                                    |

Planned, added in the phase that first uses them: `hono` and `jose` (Phase 2),
`@cloudflare/vitest-pool-workers` (Phase 3), `zod` (Phase 4), an HTML selector
library (Phase 6), `@playwright/test` and `@axe-core/playwright` (Phase 7).

## CI

`.github/workflows/ci.yml` runs typecheck, lint, tests and a build on every
push. On a pull request it deploys the `web` Worker to `preview` and checks the
security headers. The deploy needs these repository settings:

- Secrets: `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`
- Variable: `PREVIEW_URL`

Without them the deploy steps are skipped and the checks still run.

## Runbooks

Filled in as each phase lands.

### Add or remove a curator

### Rotate an API key or the service token

### Roll back code or a snapshot

### Clear a hard-stopped source

### Write a false-green incident

### Handle an operator request to stop fetching (within 48 hours)
