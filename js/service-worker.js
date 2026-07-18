// FuelTracker app-shell serviceworker. Route-, kaart- en prijsdata blijven netwerkafhankelijk.

const CACHE_PREFIX = 'fueltracker-';
const CACHE_VERSION = 'v2.0.0';
const APP_CACHE = `${CACHE_PREFIX}app-${CACHE_VERSION}`;
const RUNTIME_CACHE = `${CACHE_PREFIX}runtime-${CACHE_VERSION}`;
const BUILD_ASSET_PATHS = /* __BUILD_ASSETS__ */ [];
const APP_SHELL_PATHS = [
    './',
    './index.html',
    './offline.html',
    './css/style.css',
    './css/tailwind.generated.css',
    './manifest.json',
    './icon.svg',
    './privacy.html',
    './voorwaarden.html',
    './contact.html',
    './vendor/vue.global.prod.js',
    './vendor/leaflet/leaflet.css',
    './vendor/leaflet/leaflet.js',
    './vendor/chart.umd.js',
    './vendor/fontawesome/css/all.min.css'
];

const appUrl = path => new URL(path, self.registration.scope).href;
const APP_SHELL_URLS = [...new Set([...APP_SHELL_PATHS, ...BUILD_ASSET_PATHS])].map(appUrl);
const OFFLINE_URL = appUrl('./offline.html');
const INDEX_URL = appUrl('./index.html');

self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(APP_CACHE)
            // One optioneel bestand mag de installatie van de offline shell niet blokkeren.
            .then(cache => Promise.allSettled(APP_SHELL_URLS.map(url => cache.add(url))))
            .then(() => self.skipWaiting())
    );
});

self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys()
            .then(keys => Promise.all(
                keys
                    .filter(key => key.startsWith(CACHE_PREFIX) && ![APP_CACHE, RUNTIME_CACHE].includes(key))
                    .map(key => caches.delete(key))
            ))
            .then(() => self.clients.claim())
    );
});

self.addEventListener('fetch', event => {
    const { request } = event;
    if (request.method !== 'GET') return;

    const url = new URL(request.url);

    // Externe API- en kaarttegeldata worden nooit stilzwijgend als actueel gecachet.
    if (url.origin !== self.location.origin) return;

    if (request.mode === 'navigate') {
        event.respondWith(networkFirstNavigation(request));
        return;
    }

    event.respondWith(staleWhileRevalidate(request));
});

async function networkFirstNavigation(request) {
    try {
        const response = await fetch(request);
        if (response.ok) {
            const cache = await caches.open(RUNTIME_CACHE);
            await cache.put(request, response.clone());
        }
        return response;
    } catch {
        return (await caches.match(request))
            || (await caches.match(INDEX_URL))
            || caches.match(OFFLINE_URL);
    }
}

async function staleWhileRevalidate(request) {
    const cached = await caches.match(request);
    const update = fetch(request)
        .then(async response => {
            if (response.ok && response.type === 'basic') {
                const cache = await caches.open(RUNTIME_CACHE);
                await cache.put(request, response.clone());
            }
            return response;
        })
        .catch(() => null);

    if (cached) {
        void update;
        return cached;
    }

    return (await update) || Response.error();
}
