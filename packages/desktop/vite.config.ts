import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import tailwindcss from 'tailwindcss';
import autoprefixer from 'autoprefixer';

const host = process.env.TAURI_DEV_HOST;

export default defineConfig({
    base: './',
    plugins: [react()],

    css: {
        postcss: {
            plugins: [
                tailwindcss({ config: path.resolve(__dirname, '../../tailwind.config.ts') }),
                autoprefixer,
            ],
        },
    },

    publicDir: path.resolve(__dirname, '../core/public'),

    resolve: {
        alias: {
            '@': path.resolve(__dirname, '../core/src'),
        },
    },

    clearScreen: false,
    server: {
        host: host || false,
        port: 5174,
        strictPort: true,
        hmr: host ? { host, port: 5183 } : undefined,
    },
    envPrefix: ['VITE_', 'TAURI_ENV_*'],
    build: {
        target: ['es2021', 'chrome97', 'safari13'],
        minify: !process.env.TAURI_ENV_DEBUG ? 'esbuild' : false,
        sourcemap: !!process.env.TAURI_ENV_DEBUG,
        chunkSizeWarningLimit: 1500,
    },
});
