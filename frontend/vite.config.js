import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    proxy: {
      '/api': {
        target: 'https://scholanexusapi.vercel.app',
        changeOrigin: true,
        secure: true
      },
      '/ws': { 
        target: 'wss://scholanexusapi.vercel.app', 
        ws: true,
        changeOrigin: true,
        secure: true
      }
    }
  }
})
