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
        requireInteraction: true, // Keep it on screen
        data: { url: data.url || null },
        tag: data.tag || undefined
    };

    event.waitUntil(
        self.registration.showNotification(data.title || 'SliderApp', options)
    );
});

// Force SW to activate immediately
self.addEventListener('install', function (event) {
    self.skipWaiting();
});

self.addEventListener('activate', function (event) {
    event.waitUntil(clients.claim());
});

self.addEventListener('notificationclick', function (event) {
    event.notification.close();

    const path = event.notification.data?.url;
    const destination = new URL(path || '/', self.location.origin);
    // Never let a notification redirect to a different website.
    if (destination.origin !== self.location.origin) {
        destination.href = self.location.origin + '/';
    }

    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true })
            .then(async function (clientList) {
                const sameOrigin = clientList.filter(client => {
                    try { return new URL(client.url).origin === self.location.origin; }
                    catch (_) { return false; }
                });

                if (path) {
                    const chatWindow = sameOrigin.find(client => {
                        try { return new URL(client.url).pathname === destination.pathname; }
                        catch (_) { return false; }
                    });
                    if (chatWindow?.focus) return chatWindow.focus();
                    if (sameOrigin.length && sameOrigin[0].navigate) {
                        const updated = await sameOrigin[0].navigate(destination.href);
                        if (updated?.focus) return updated.focus();
                    }
                    if (clients.openWindow) return clients.openWindow(destination.href);
                }

                // Retain the original reminder notification behavior.
                if (sameOrigin.length && sameOrigin[0].focus) return sameOrigin[0].focus();
                if (clients.openWindow) return clients.openWindow('/');
            })
    );
});
