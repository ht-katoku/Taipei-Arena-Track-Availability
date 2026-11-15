import { describe, expect, it } from "vitest";
import { contentSecurityPolicy, securityHeaders } from "../src/web/securityHeaders";
import { placeholderResponse } from "../src/web/placeholder";

describe("security headers", () => {
  it("sets the TRD content security policy", () => {
    expect(contentSecurityPolicy()).toBe(
      "default-src 'none'; style-src 'self'; script-src 'self'; img-src 'self' data:",
    );
  });

  it("adds the inline script hash to script-src only", () => {
    const csp = contentSecurityPolicy("abc123=");
    expect(csp).toContain("script-src 'self' 'sha256-abc123='");
    expect(csp).toContain("style-src 'self';");
  });

  it("sets HSTS, nosniff and no-referrer", () => {
    const headers = securityHeaders();
    expect(headers["Strict-Transport-Security"]).toMatch(/^max-age=\d+/);
    expect(headers["X-Content-Type-Options"]).toBe("nosniff");
    expect(headers["Referrer-Policy"]).toBe("no-referrer");
  });
});

describe("placeholder page", () => {
  it("carries every security header and sets no cookie", () => {
    const response = placeholderResponse();
    for (const name of Object.keys(securityHeaders())) {
      expect(response.headers.get(name)).not.toBeNull();
    }
    expect(response.headers.get("Set-Cookie")).toBeNull();
    expect(response.headers.get("Content-Type")).toBe("text/html; charset=utf-8");
  });
});
