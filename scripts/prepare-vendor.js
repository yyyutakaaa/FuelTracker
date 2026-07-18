import { copyFile, cp, mkdir, rm } from 'node:fs/promises';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');

async function copy(source, destination) {
    const target = resolve(root, 'vendor', destination);
    await mkdir(resolve(target, '..'), { recursive: true });
    await copyFile(resolve(root, 'node_modules', source), target);
}

await rm(resolve(root, 'vendor'), { recursive: true, force: true });

await Promise.all([
    copy('vue/dist/vue.global.prod.js', 'vue.global.prod.js'),
    copy('leaflet/dist/leaflet.js', 'leaflet/leaflet.js'),
    copy('leaflet/dist/leaflet.css', 'leaflet/leaflet.css'),
    copy('chart.js/dist/chart.umd.js', 'chart.umd.js'),
    copy('@fortawesome/fontawesome-free/css/all.min.css', 'fontawesome/css/all.min.css')
]);

await Promise.all([
    cp(resolve(root, 'node_modules/leaflet/dist/images'), resolve(root, 'vendor/leaflet/images'), { recursive: true }),
    cp(resolve(root, 'node_modules/@fortawesome/fontawesome-free/webfonts'), resolve(root, 'vendor/fontawesome/webfonts'), { recursive: true })
]);
