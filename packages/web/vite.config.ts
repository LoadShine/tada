import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import tailwindcss from 'tailwindcss';
import autoprefixer from 'autoprefixer';

export default defineConfig({
    base: '/tada/',
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

    server: {
        port: 5173
    },
});