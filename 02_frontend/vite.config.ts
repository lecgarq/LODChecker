import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vite.dev/config/
export default defineConfig({
  base: process.env.VITE_PUBLIC_BASE || '/',
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5173,
    strictPort: true,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:5000',
        changeOrigin: true,
      },
      '/img': {
        target: 'http://127.0.0.1:5000',
        changeOrigin: true,
      },
      '/vectors': {
        target: 'http://127.0.0.1:5000',
        changeOrigin: true,
      }
    }
  }
})
