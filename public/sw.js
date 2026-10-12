self.addEventListener('install', (event) => {
  event.waitUntil(caches.open('minha-rotina-v1').then((cache) => cache.add('/')))
})

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET' || new URL(event.request.url).origin !== self.location.origin) return
  event.respondWith(fetch(event.request).then((response) => {
    if (response.ok) void caches.open('minha-rotina-v1').then((cache) => cache.put(event.request, response.clone()))
    return response
  }).catch(async () => {
    const cache = await caches.open('minha-rotina-v1')
    const response = await cache.match(event.request)
    return response || (event.request.mode === 'navigate' ? cache.match('/') : Response.error())
  }))
})
