import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import * as path from "node:path";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
      },
      '/backgrounds': { // If you are serving local backgrounds from the public folder
        target: 'http://localhost:5173', // Point to itself, Vite will handle it
        changeOrigin: false,
      }
    }
  }
})
