// Service worker for the home-screen web app. Its only job is notifications:
// it shows pushes sent by the server and opens the app when one is tapped.
// It deliberately caches nothing, so the app itself always loads fresh.

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));

self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    // Not JSON; fall through to the generic notification below.
  }
  // iOS requires every push to show a notification.
  event.waitUntil(
    self.registration.showNotification(data.title || 'Receipts', {
      body: data.body || '',
      icon: '/icon-192.png',
      tag: data.tag,
      data: { path: data.url || '/' },
    }),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const path = (event.notification.data && event.notification.data.path) || '/';
  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      if (windows.length > 0) {
        // The app is already open: bring it forward and let it navigate itself.
        await windows[0].focus();
        windows[0].postMessage({ type: 'open', path });
      } else {
        // Always open the home address (which is guaranteed to load) and pass the destination along.
        await self.clients.openWindow('/?open=' + encodeURIComponent(path));
      }
    })(),
  );
});
