self.addEventListener('push', function (event) {
    console.log('[Service Worker] Push Received.');

    let data = { title: 'SliderApp', body: 'New notification', icon: '/icon-192x192.png' };

    if (event.data) {
        try {
            data = event.data.json();
        } catch (e) {
            data.body = event.data.text();
        }
    }

    const title = data.title || 'SliderApp';
    const options = {
        body: data.body,
        icon: data.icon || '/icon-192x192.png',
        badge: '/icon-192x192.png',
        vibrate: [100, 50, 100],
        tag: data.tag || 'general-notification',
        renotify: true, // Crucial for repeated alerts
        requireInteraction: true, // Keep notification until user clicks
        data: {
            dateOfArrival: Date.now(),
            primaryKey: '2'
        }
    };

    event.waitUntil(
        self.registration.showNotification(title, options)
    );
});

self.addEventListener('notificationclick', function (event) {
    event.notification.close();
    event.waitUntil(
        clients.openWindow('/')
    );
});
