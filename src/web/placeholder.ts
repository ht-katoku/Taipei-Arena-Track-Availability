import { copy } from "../shared/copy";
import { securityHeaders } from "./securityHeaders";

// Phase 1 placeholder. Phase 5 replaces this with KV-backed routes.
// The strings are constants from copy.ts, so there is nothing to escape.
export function placeholderResponse(): Response {
  const html =
    `<!doctype html><html lang="zh-Hant-TW"><meta charset="utf-8">` +
    `<meta name="viewport" content="width=device-width,initial-scale=1">` +
    `<title>${copy.site.title}</title>` +
    `<h1>${copy.site.title}</h1><p>${copy.placeholder.body}</p><p>${copy.site.unofficial}</p></html>`;
  return new Response(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
      ...securityHeaders(),
    },
  });
}
