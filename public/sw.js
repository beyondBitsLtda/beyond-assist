// Service worker mínimo do Beyond Bits — só trata push e clique na notificação.
// Não faz cache de nada (não é um PWA offline-first, só o canal de notificação).

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { title: "Beyond Bits", body: event.data ? event.data.text() : "" };
  }

  const title = data.title || "Beyond Bits";
  const options = {
    body: data.body || "",
    icon: data.icon || "/icon.png",
    badge: data.badge || "/icon.png",
    data: { url: data.url || "/" },
    tag: data.tag || undefined, // mesma tag substitui notificação anterior em vez de empilhar
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url || "/";
  // `focar`: a página que mandou o aviso ainda está aberta com o resultado na tela (Modo
  // Tomar nota) — só traz a aba de volta; navegar recarregaria e perderia o que está nela.
  const focar = !!event.notification.data?.focar;

  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((windowClients) => {
      for (const client of windowClients) {
        if (client.url.includes(self.location.origin) && "focus" in client) {
          if (!focar) client.navigate(url);
          return client.focus();
        }
      }
      return clients.openWindow(url);
    })
  );
});
