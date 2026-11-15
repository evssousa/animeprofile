/* Service worker do app Anime Profile (PWA).
 * - Recebe os pushes (Firebase Cloud Messaging) e mostra a notificação no celular/computador.
 * - Ao tocar na notificação, abre (ou foca) o site na página certa.
 * - Sem internet, a navegação mostra /offline.html em vez da tela de erro do navegador.
 * Não guarda o resto do site em cache: cada publicação nova do site chega na hora.
 */
const OFFLINE_CACHE = "ap-offline-v1";
const OFFLINE_URL = "/offline.html";

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(OFFLINE_CACHE)
      .then((c) => c.addAll([OFFLINE_URL, "/icons/icon-192.png"]))
      .catch(() => undefined)
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith("ap-offline-") && k !== OFFLINE_CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

// Só as navegações (abrir uma página): rede primeiro; sem rede, a página offline.
self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.mode !== "navigate" || req.method !== "GET") return;
  event.respondWith(
    fetch(req).catch(() => caches.match(OFFLINE_URL).then((r) => r || new Response("Sem conexão", { status: 503, headers: { "content-type": "text/plain; charset=utf-8" } }))),
  );
});

/** Lê o push do FCM: { notification: {title, body, icon, tag}, data: {url, title, body, tag}, fcmOptions: {link} } */
function readPush(event) {
  let p = {};
  try {
    p = event.data ? event.data.json() : {};
  } catch (e) {
    p = { notification: { body: event.data ? event.data.text() : "" } };
  }
  const n = p.notification || {};
  const d = p.data || {};
  return {
    title: n.title || d.title || "Anime Profile",
    body: n.body || d.body || "",
    icon: n.icon || d.icon || "/icons/icon-192.png",
    tag: n.tag || d.tag || undefined,
    url: d.url || (p.fcmOptions && p.fcmOptions.link) || n.click_action || "/",
  };
}

self.addEventListener("push", (event) => {
  const m = readPush(event);
  event.waitUntil(
    self.registration.showNotification(m.title, {
      body: m.body,
      icon: m.icon,
      badge: "/icons/icon-192.png",
      tag: m.tag,
      renotify: !!m.tag,
      data: { url: m.url },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = new URL((event.notification.data && event.notification.data.url) || "/", self.location.origin).href;
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((wins) => {
      // Já tem o site aberto: usa essa janela.
      for (const w of wins) {
        if (w.url.startsWith(self.location.origin)) {
          return w.focus().then(() => ("navigate" in w ? w.navigate(target) : undefined)).catch(() => self.clients.openWindow(target));
        }
      }
      return self.clients.openWindow(target);
    }),
  );
});
