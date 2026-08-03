import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      // Alias pour imports plus courts : '@/components' au lieu de '../../../components'
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    allowedHosts:true,
    // Proxy pour éviter les problèmes CORS en développement
    proxy: {
      '/api': {
        target: 'http://57.131.134.241:8001', // Ton backend Django
        changeOrigin: true,
        secure: false,
      },
    },
  },
})
