const CACHE = "petrosphere-tms-shell-v1"
const PRECACHE = [
  "/",
  "/dashboard",
  "/login",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/offline.html",
]

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting())
      .catch(() => undefined)
  )
})

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  )
})

self.addEventListener("fetch", (event) => {
  const { request } = event
  if (request.method !== "GET") return

  const url = new URL(request.url)
  if (url.origin !== self.location.origin) return
  if (url.pathname.startsWith("/api/")) return

  event.respondWith(
    fetch(request)
      .then((response) => {
        const copy = response.clone()
        if (
          response.ok &&
          (request.mode === "navigate" ||
            request.destination === "style" ||
            request.destination === "script" ||
            request.destination === "image")
        ) {
          caches.open(CACHE).then((cache) => cache.put(request, copy)).catch(() => undefined)
        }
        return response
      })
      .catch(async () => {
        const cached = await caches.match(request)
        if (cached) return cached
        if (request.mode === "navigate") {
          const offline = await caches.match("/offline.html")
          if (offline) return offline
        }
        return Response.error()
      })
  )
})
