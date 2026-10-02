// Service worker for the admin app: receives push notifications about new orders.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { body: event.data ? event.data.text() : "" };
  }
  event.waitUntil(
    self.registration.showNotification(data.title || "Green Glow", {
      body: data.body || "",
      icon: "/icon-192.png",
      badge: "/favicon-32.png",
      tag: data.tag || "order",
      renotify: true,
      lang: "ar",
      dir: "rtl",
      data: { url: data.url || "/admin/" },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || "/admin/";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((windows) => {
      for (const client of windows) {
        if (client.url.includes("/admin") && "focus" in client) return client.focus();
      }
      return self.clients.openWindow(url);
    }),
  );
});
