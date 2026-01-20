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
        icon: self.location.origin + '/icon-192x192.png', // Absolute path for Android
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
        clients.matchAll({ type: 'window', includeUncontrolled: true })
            .then(function (clientList) {
                // If there is already a window open, focus it
                for (let i = 0; i < clientList.length; i++) {
                    const client = clientList[i];
                    if (client.url && 'focus' in client) {
                        return client.focus();
                    }
                }
                // If no window is open, open a new one
                if (clients.openWindow) {
                    return clients.openWindow('/');
                }
            })
    );
});
