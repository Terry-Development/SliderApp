self.addEventListener('push', function (event) {
    console.log('[Service Worker] Push Received.');

    // Default data
    let data = { title: 'SliderApp', body: 'New notification' };

    if (event.data) {
        try {
            const json = event.data.json();
            if (json) data = json;
        } catch (e) {
            console.warn('Push data not JSON, using text');
            data.body = event.data.text();
        }
    }

    const options = {
        body: data.body,
        icon: '/icon-192x192.png', // Hardcode valid local path
        badge: '/icon-192x192.png',
        vibrate: [100, 50, 100],
        requireInteraction: true // Keep it on screen
    };

    event.waitUntil(
        self.registration.showNotification(data.title || 'SliderApp', options)
    );
});

self.addEventListener('notificationclick', function (event) {
    event.notification.close();
    event.waitUntil(
        clients.openWindow('/')
    );
});
