// Security headers for every public response (TRD, Security requirements).
// `inlineScriptHash` is the sha256 of the single P1 inline script, added in
// Phase 4 so that `script-src 'self'` does not block it.

export function contentSecurityPolicy(inlineScriptHash?: string): string {
  const scriptSrc = inlineScriptHash ? `'self' 'sha256-${inlineScriptHash}'` : "'self'";
  return [
    "default-src 'none'",
    "style-src 'self'",
    `script-src ${scriptSrc}`,
    "img-src 'self' data:",
  ].join("; ");
}

export function securityHeaders(inlineScriptHash?: string): Record<string, string> {
  return {
    "Content-Security-Policy": contentSecurityPolicy(inlineScriptHash),
    "Strict-Transport-Security": "max-age=31536000; includeSubDomains",
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "no-referrer",
  };
}
