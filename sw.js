// sw.js - Service Worker для AbSgram HD
const CACHE_NAME = 'absgram-v1';
const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/manifest.json'
];

self.addEventListener('install', (event) => {
  console.log('🔧 Service Worker устанавливается...');
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('📦 Кэширование ресурсов...');
        return cache.addAll(ASSETS_TO_CACHE);
      })
  );
});

self.addEventListener('activate', (event) => {
  console.log('✅ Service Worker активирован');
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('🗑️ Удаление старого кэша:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.url.includes('firebase') || 
      event.request.url.includes('onesignal') ||
      event.request.url.includes('googleapis') ||
      event.request.url.includes('gstatic.com') ||
      event.request.url.includes('github')) {
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        if (response && response.status === 200) {
          const responseToCache = response.clone();
          caches.open(CACHE_NAME)
            .then((cache) => {
              cache.put(event.request, responseToCache);
            });
        }
        return response;
      })
      .catch(() => {
        return caches.match(event.request)
          .then((response) => {
            if (response) {
              return response;
            }
            if (event.request.destination === 'document') {
              return caches.match('/index.html');
            }
          });
      })
  );
});

self.addEventListener('push', (event) => {
  console.log('📨 Получено push-уведомление:', event);

  let notificationData = {
    title: 'AbSgram HD',
    body: 'Новое сообщение',
    icon: 'https://via.placeholder.com/192x192?text=AbSgram',
    badge: 'https://via.placeholder.com/96x96?text=A',
    vibrate: [200, 100, 200],
    requireInteraction: true,
    data: {
      url: self.location.origin,
      timestamp: Date.now()
    }
  };

  try {
    if (event.data) {
      const data = event.data.json();
      notificationData = {
        ...notificationData,
        title: data.title || notificationData.title,
        body: data.body || notificationData.body,
        data: {
          ...notificationData.data,
          ...data.data
        }
      };
    }
  } catch (error) {
    console.error('❌ Ошибка парсинга push-уведомления:', error);
  }

  event.waitUntil(
    self.registration.showNotification(notificationData.title, {
      body: notificationData.body,
      icon: notificationData.icon,
      badge: notificationData.badge,
      vibrate: notificationData.vibrate,
      requireInteraction: notificationData.requireInteraction,
      data: notificationData.data,
      actions: [
        {
          action: 'open',
          title: '📱 Открыть AbSgram'
        },
        {
          action: 'close',
          title: '❌ Закрыть'
        }
      ]
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  console.log('🔔 Клик по уведомлению:', event);

  event.notification.close();

  if (event.action === 'close') {
    return;
  }

  event.waitUntil(
    clients.matchAll({
      type: 'window',
      includeUncontrolled: true
    }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow('/');
      }
    })
  );
});