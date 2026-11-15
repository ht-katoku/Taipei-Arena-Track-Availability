// Curator surface. Phase 2 adds the Cloudflare Access JWT middleware.
// Until then every request is refused, so the stub fails closed.
export default {
  fetch(): Response {
    return new Response("Forbidden", { status: 403, headers: { "Cache-Control": "no-store" } });
  },
} satisfies ExportedHandler;
