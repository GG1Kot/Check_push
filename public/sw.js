self.addEventListener("push", (event) => {
  let data = { title: "GitHub Changes", body: "New GitHub change", url: "/" };
  try { if (event.data) data = { ...data, ...event.data.json() }; } catch {}
  event.waitUntil(self.registration.showNotification(data.title, {
    body: data.body,
    icon: "/icon-192.png",
    badge: "/icon-192.png",
    tag: data.tag || "github-change",
    data: { url: data.url || "/" }
  }));
});
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url || "/";
  event.waitUntil(clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
    for (const client of list) { if (client.url.includes(url) && "focus" in client) return client.focus(); }
    return clients.openWindow(url);
  }));
});
