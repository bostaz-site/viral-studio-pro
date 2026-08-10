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
      // 1. Delete ALL caches (va-v1, va-v2, any others)
      const keys = await caches.keys()
      await Promise.all(keys.map((k) => caches.delete(k)))

      // 2. Claim all clients so we can reload them
      await self.clients.claim()

      // 3. Unregister this service worker
      const reg = await self.registration.unregister()
      if (reg) {
        // eslint-disable-next-line no-console
        console.log('[sw] Service worker unregistered — kill switch complete')
      }

      // 4. Reload all open tabs to clear any cached navigation responses
      const clients = await self.clients.matchAll({ type: 'window' })
      for (const client of clients) {
        if (client.url && 'navigate' in client) {
          client.navigate(client.url)
        }
      }
    })()
  )
})
