import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = path => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('webmanifest is installable and works below a repository subpath', async () => {
    const manifest = JSON.parse(await read('manifest.json'));

    assert.equal(manifest.start_url, './');
    assert.equal(manifest.scope, './');
    assert.equal(manifest.display, 'standalone');
    assert.ok(manifest.name && manifest.short_name && manifest.description);
    assert.ok(manifest.icons.some(icon => icon.src === './icon.svg' && icon.sizes === 'any'));
    assert.ok(manifest.shortcuts.every(shortcut => shortcut.url.startsWith('./')));
});

test('serviceworker keeps deployment URLs relative to its registration scope', async () => {
    const worker = await read('js/service-worker.js');
    const rootWorker = await read('service-worker.js');

    assert.match(worker, /self\.registration\.scope/);
    assert.match(worker, /url\.origin !== self\.location\.origin/);
    assert.match(worker, /request\.mode === 'navigate'/);
    assert.match(worker, /offline\.html/);
    assert.doesNotMatch(worker, /caches\.match\('\//);
    assert.doesNotMatch(worker, /\n\s*'\/index\.html'/);
    assert.match(rootWorker, /importScripts\('\.\/js\/service-worker\.js'\)/);
});

test('app icon content matches its declared SVG media type', async () => {
    const icon = await read('icon.svg');
    assert.match(icon, /^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg"/);
    assert.match(icon, /viewBox="0 0 512 512"/);
});

test('offline and legal pages are present and mutually linked', async () => {
    const [offline, privacy, terms, contact] = await Promise.all([
        read('offline.html'),
        read('privacy.html'),
        read('voorwaarden.html'),
        read('contact.html')
    ]);

    assert.match(offline, /route heeft internet nodig/i);
    assert.match(privacy, /Nominatim/);
    assert.match(privacy, /localStorage/i);
    assert.match(terms, /ramingen/i);
    assert.match(contact, /github\.com\/yyyutakaaa\/FuelTracker\/issues/);
    assert.match(privacy, /voorwaarden\.html/);
    assert.match(terms, /privacy\.html/);
});

test('runtime dependency versions are exact and production CSS is compiled', async () => {
    const packageJson = JSON.parse(await read('package.json'));
    const versions = {
        ...packageJson.dependencies,
        ...packageJson.devDependencies
    };

    for (const [name, version] of Object.entries(versions)) {
        assert.match(version, /^\d+\.\d+\.\d+$/, `${name} must use an exact version`);
    }

    assert.match(packageJson.scripts.build, /build:css/);
    assert.match(packageJson.scripts.build, /vite build/);
});

test('production entry uses local assets and a root-scoped serviceworker', async () => {
    const index = await read('index.html');

    assert.match(index, /vendor\/vue\.global\.prod\.js/);
    assert.match(index, /vendor\/leaflet\/leaflet\.js/);
    assert.match(index, /vendor\/chart\.umd\.js/);
    assert.match(index, /css\/tailwind\.generated\.css/);
    assert.match(index, /register\('service-worker\.js'\)/);
    assert.doesNotMatch(index, /cdn\.tailwindcss|unpkg\.com|cdn\.jsdelivr\.net|cdnjs\.cloudflare\.com/);
});

test('Vite keeps the canonical manifest at app-root in its final HTML', async () => {
    const config = await read('vite.config.js');
    assert.match(config, /index\.replace\(\/\(<link/);
    assert.match(config, /\.\/manifest\.json/);
});
