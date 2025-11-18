self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  self.clients.claim();
});

self.addEventListener('push', (event) => {
  const data = event.data?.json() || {};
  if (data.type === 'approvals_update') {
    const total = Number(data.total || 0);
    const title = total > 0 ? `Você tem ${total} aprovações pendentes` : 'Atualização de aprovações';
    const body = total > 0 ? `Soma de A1 + A2: ${total}. Toque para revisar.` : 'Sem pendências no momento.';
    event.waitUntil(
      self.registration.showNotification(title, {
        body,
        tag: 'approvals-badge',
        renotify: true,
        data: { total },
        icon: '/icons/icon-192.png',
        badge: '/icons/badge-72.png'
      })
    );
  }
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil((async () => {
    const allClients = await clients.matchAll({ includeUncontrolled: true, type: 'window' });
    const url = '/kanban';
    const existing = allClients.find(c => c.url.includes(url));
    if (existing) return existing.focus();
    return clients.openWindow(url);
  })());
});