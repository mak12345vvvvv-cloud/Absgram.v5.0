// sw.js - Service Worker для AbSgram HD
const CACHE_NAME = 'absgram-v1';
const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/manifest.json',
  'https://fonts.googleapis.com/css2?family=Segoe+UI:wght@400;600;700&display=swap',
  'https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.page.js'
];

// Установка Service Worker и кэширование ресурсов
self.addEventListener('install', (event) => {
  console.log('🔧 Service Worker устанавливается...');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('📦 Кэширование ресурсов...');
        return cache.addAll(ASSETS_TO_CACHE);
      })
      .then(() => self.skipWaiting())
  );
});

// Активация Service Worker
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

// Перехват запросов (офлайн-режим)
self.addEventListener('fetch', (event) => {
  // Пропускаем запросы к Firebase и OneSignal
  if (event.request.url.includes('firebase') || 
      event.request.url.includes('onesignal') ||
      event.request.url.includes('googleapis') ||
      event.request.url.includes('gstatic.com')) {
    return;
  }

  event.respondWith(
    caches.match(event.request)
      .then((response) => {
        return response || fetch(event.request)
          .then((fetchResponse) => {
            // Кэшируем только успешные ответы
            if (fetchResponse && fetchResponse.status === 200) {
              const responseToCache = fetchResponse.clone();
              caches.open(CACHE_NAME)
                .then((cache) => {
                  cache.put(event.request, responseToCache);
                });
            }
            return fetchResponse;
          });
      })
      .catch(() => {
        // Если запрос не удался и это HTML-страница, возвращаем кэшированную главную
        if (event.request.destination === 'document') {
          return caches.match('/index.html');
        }
      })
  );
});

// Обработка push-уведомлений
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

// Обработка кликов по уведомлениям
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

// Обработка сообщений от основного потока
self.addEventListener('message', (event) => {
  console.log('💬 Сообщение от основного потока:', event.data);
  
  if (!event.data) return;

  if (event.data.type === 'INIT') {
    console.log('✅ Получен INIT от клиента, ID:', event.data.clientId);
    // Отвечаем клиенту
    if (event.source) {
      event.source.postMessage({
        type: 'READY',
        status: 'ok'
      });
    }
  }
  
  if (event.data.type === 'SHOW_NOTIFICATION') {
    self.registration.showNotification(event.data.title, {
      body: event.data.body,
      icon: event.data.icon || 'https://via.placeholder.com/192x192?text=AbSgram',
      badge: event.data.badge || 'https://via.placeholder.com/96x96?text=A',
      vibrate: event.data.vibrate || [200, 100, 200],
      requireInteraction: event.data.requireInteraction || true,
      data: event.data.data || {}
    });
    console.log('🔔 Показано уведомление по запросу клиента:', event.data.title);
  }
  
  if (event.data.type === 'UPDATE_STATUS') {
    console.log('📊 Статус пользователя обновлен:', event.data);
  }
});