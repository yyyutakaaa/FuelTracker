import { copyFile, cp, mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { defineConfig } from 'vite';

const root = resolve(import.meta.dirname);

async function copy(source, destination) {
    const target = resolve(root, 'dist', destination);
    await mkdir(resolve(target, '..'), { recursive: true });
    await copyFile(resolve(root, source), target);
}

async function listFiles(directory, prefix = '') {
    const entries = await readdir(directory, { withFileTypes: true });
    const files = await Promise.all(entries.map(async entry => {
        const relativePath = prefix ? `${prefix}/${entry.name}` : entry.name;
        if (entry.isDirectory()) {
            return listFiles(resolve(directory, entry.name), relativePath);
        }
        return relativePath;
    }));
    return files.flat();
}

function copyStaticAndVendorAssets() {
    return {
        name: 'fueltracker-static-assets',
        apply: 'build',
        async closeBundle() {
            await Promise.all([
                copy('manifest.json', 'manifest.json'),
                copy('icon.svg', 'icon.svg'),
                copy('js/service-worker.js', 'service-worker.js'),
                copy('node_modules/vue/dist/vue.global.prod.js', 'vendor/vue.global.prod.js'),
                copy('node_modules/leaflet/dist/leaflet.js', 'vendor/leaflet/leaflet.js'),
                copy('node_modules/leaflet/dist/leaflet.css', 'vendor/leaflet/leaflet.css'),
                copy('node_modules/chart.js/dist/chart.umd.js', 'vendor/chart.umd.js'),
                copy('node_modules/@fortawesome/fontawesome-free/css/all.min.css', 'vendor/fontawesome/css/all.min.css')
            ]);

            await Promise.all([
                cp(resolve(root, 'node_modules/leaflet/dist/images'), resolve(root, 'dist/vendor/leaflet/images'), { recursive: true }),
                cp(resolve(root, 'node_modules/@fortawesome/fontawesome-free/webfonts'), resolve(root, 'dist/vendor/fontawesome/webfonts'), { recursive: true })
            ]);

            // Vite fingerprints application assets. Inject their final paths into the
            // generated worker, while keeping the source worker usable in development.
            const outputFiles = await listFiles(resolve(root, 'dist'));
            const buildAssets = outputFiles
                .filter(file => file !== 'service-worker.js')
                .filter(file => /\.(?:css|html|js|json|png|svg|woff2)$/.test(file))
                .map(file => `./${file}`)
                .sort();
            const workerPath = resolve(root, 'dist/service-worker.js');
            const worker = await readFile(workerPath, 'utf8');
            await writeFile(
                workerPath,
                worker.replace('/* __BUILD_ASSETS__ */ []', JSON.stringify(buildAssets, null, 4)),
                'utf8'
            );

            // A manifest's relative icon paths resolve from the manifest location.
            // Keep the canonical manifest at the app root instead of Vite's assets dir.
            const indexPath = resolve(root, 'dist/index.html');
            const index = await readFile(indexPath, 'utf8');
            await writeFile(
                indexPath,
                index.replace(/(<link\s+rel="manifest"\s+href=")[^"]+("\s*>)/, '$1./manifest.json$2'),
                'utf8'
            );
        }
    };
}

export default defineConfig({
    base: './',
    plugins: [copyStaticAndVendorAssets()],
    build: {
        rollupOptions: {
            input: {
                app: resolve(root, 'index.html'),
                privacy: resolve(root, 'privacy.html'),
                voorwaarden: resolve(root, 'voorwaarden.html'),
                contact: resolve(root, 'contact.html'),
                offline: resolve(root, 'offline.html')
            }
        }
    }
});
