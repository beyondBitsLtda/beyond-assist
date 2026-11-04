// Service worker da Lisa_Proof: só recebe os lembretes e abre o app ao tocar neles.
// Não guarda cache de página de propósito — o app é sempre online (os dados vêm do banco).

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));

self.addEventListener("push", (evento) => {
  let dados = {};
  try {
    dados = evento.data ? evento.data.json() : {};
  } catch {
    dados = { body: evento.data ? evento.data.text() : "" };
  }
  evento.waitUntil(
    self.registration.showNotification(dados.title || "Lisa_Proof", {
      body: dados.body || "Hora de estudar!",
      icon: "/icone-192.png",
      badge: "/icone-192.png",
      tag: dados.tag || "lisa-proof",
      renotify: true,
      data: { url: dados.url || "/" },
    })
  );
});

self.addEventListener("notificationclick", (evento) => {
  evento.notification.close();
  const destino = new URL(evento.notification.data?.url || "/", self.location.origin).href;
  evento.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((janelas) => {
      for (const j of janelas) {
        if (j.url.startsWith(self.location.origin)) {
          j.navigate(destino);
          return j.focus();
        }
      }
      return self.clients.openWindow(destino);
    })
  );
});
