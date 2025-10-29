// FuelTracker - Service Worker

const CACHE_NAME = 'fueltracker-v1.0.0';
const urlsToCache = [
    '/',
    '/index.html',
    '/css/style.css',
    '/js/app.js',
    '/manifest.json',
    '/icon-192.png',
    '/icon-512.png'
];

// Install service worker
self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => {
                console.log('Opened cache');
                return cache.addAll(urlsToCache);
            })
    );
});

// Activate service worker
self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.map(cacheName => {
                    if (cacheName !== CACHE_NAME) {
                        console.log('Deleting old cache:', cacheName);
                        return caches.delete(cacheName);
                    }
                })
            );
        })
    );
});

// Fetch event
self.addEventListener('fetch', event => {
    // Skip cross-origin requests
    if (!event.request.url.startsWith(self.location.origin) && 
        !event.request.url.includes('unpkg.com') &&
        !event.request.url.includes('jsdelivr.net') &&
        !event.request.url.includes('cdnjs.cloudflare.com') &&
        !event.request.url.includes('tailwindcss.com')) {
        return;
    }
    
    event.respondWith(
        caches.match(event.request)
            .then(response => {
                // Cache hit - return response
                if (response) {
                    return response;
                }
                
                // Clone the request
                const fetchRequest = event.request.clone();
                
                return fetch(fetchRequest).then(response => {
                    // Check if valid response
                    if (!response || response.status !== 200 || response.type === 'opaque') {
                        return response;
                    }
                    
                    // Clone the response
                    const responseToCache = response.clone();
                    
                    // Don't cache API calls
                    if (!event.request.url.includes('nominatim') && 
                        !event.request.url.includes('router.project-osrm') &&
                        !event.request.url.includes('bestat.statbel')) {
                        caches.open(CACHE_NAME)
                            .then(cache => {
                                cache.put(event.request, responseToCache);
                            });
                    }
                    
                    return response;
                });
            })
            .catch(() => {
                // Offline fallback
                if (event.request.destination === 'document') {
                    return caches.match('/index.html');
                }
            })
    );
});

// Background sync for offline calculations
self.addEventListener('sync', event => {
    if (event.tag === 'sync-calculations') {
        event.waitUntil(syncCalculations());
    }
});

async function syncCalculations() {
    // Future feature: sync offline calculations when back online
    console.log('Syncing offline calculations...');
}