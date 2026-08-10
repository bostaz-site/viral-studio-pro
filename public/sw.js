// Viral Animal — Service Worker Kill Switch
//
// This file MUST remain at /sw.js so browsers with the old SW fetch it,
// install this version, and self-destruct. After this runs once:
// - All caches are deleted (no more stale offline.html)
// - The SW unregisters itself
// - All open tabs reload with a clean state
//
// DO NOT add any fetch handler. This file should do nothing except clean up.

self.addEventListener('install', () => {
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      // 1. Check if there are stale caches to clean (old SW was here)
      const keys = await caches.keys()
      const hadCaches = keys.length > 0

      // 2. Delete ALL caches
      if (hadCaches) {
        await Promise.all(keys.map((k) => caches.delete(k)))
      }

      // 3. Claim all clients
      await self.clients.claim()

      // 4. Unregister this service worker
      await self.registration.unregister()

      // 5. Reload tabs ONLY if we actually cleaned stale caches
      //    (= old SW was installed). Without this guard, a fresh
      //    register() → activate with no caches would reload in a loop.
      if (hadCaches) {
        const allClients = await self.clients.matchAll({ type: 'window' })
        for (const client of allClients) {
          if (client.url && 'navigate' in client) {
            client.navigate(client.url)
          }
        }
      }
    })()
  )
})
