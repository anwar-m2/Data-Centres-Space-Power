import { defineConfig } from 'vite'

// Proxy /api requests to local backend during dev
export default defineConfig({
  server: {
    proxy: {
      '/api': 'http://localhost:3000'
    }
  }
})
