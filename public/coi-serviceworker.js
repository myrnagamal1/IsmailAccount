/* coi-serviceworker v0.1.7 - https://github.com/gzuidhof/coi-serviceworker */
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

function isWASMOrSharedBuffer(url) {
  return url.endsWith(".wasm") || url.endsWith(".data");
}

self.addEventListener("fetch", function (event) {
  const r = event.request;
  if (r.cache === "only-if-cached" && r.mode !== "same-origin") return;
  event.respondWith(
    fetch(r).then(function (response) {
      if (response.status === 0) return response;
      const headers = new Headers(response.headers);
      headers.set("Cross-Origin-Embedder-Policy", "require-corp");
      headers.set("Cross-Origin-Opener-Policy", "same-origin");
      return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers,
      });
    })
  );
});
