// The committed source allowlist. The fetch wrapper (Phase 6) refuses any host
// that is not listed here, and the `source` table is seeded from this file.
// URLs are never read from the database or from an admin request (SSRF guard).

export type SourceKind =
  | "venue_notice" // rank 2
  | "competition_calendar" // rank 3
  | "regulations" // rank 4
  | "open_data"
  | "cwa"
  | "moenv";

export interface SourceConfig {
  id: string;
  name: string;
  kind: SourceKind;
  url: string;
  enabled: boolean;
  /** Shadow sources write fetch_run, R2 and a parse report, never facts. */
  mode: "shadow" | "live";
  /** What the resolver does with this source's facts when its latest run failed. */
  onFailure: "unknown" | "keep";
  minIntervalS: number;
  cronMinute: number;
}

// Empty until docs/sources-discovery.md is confirmed. No source is added here
// without a robots.txt verdict recorded in that file.
export const sources: readonly SourceConfig[] = [];
