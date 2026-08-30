// Service worker for one job only: showing cooking-timer notifications, which
// phones will not display for a web app any other way.
//
// It deliberately has NO fetch handler and caches nothing. A caching worker would
// keep serving old copies of the app after a deploy, which is exactly the kind of
// "why am I still seeing the old version" confusion this app doesn't need.

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

// Tapping the notification should land on the step whose timer just finished —
// reusing the already-open app when there is one.
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = (event.notification.data && event.notification.data.url) || "/";

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if ("focus" in client) {
          if ("navigate" in client && target) {
            return client.navigate(target).then((c) => (c ? c.focus() : client.focus()));
          }
          return client.focus();
        }
      }
      return self.clients.openWindow(target);
    })
  );
});
