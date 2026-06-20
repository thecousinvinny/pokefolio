// Intentionally unregisters itself — replaced by direct network requests
self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', e => {
  e.waitUntil(self.registration.unregister())
})
