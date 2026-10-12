import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [react(), tailwindcss(), VitePWA({
    registerType: 'autoUpdate',
    includeAssets: ['apple-touch-icon.png', 'icon-192.png', 'icon-512.png'],
    manifest: {
      name: 'Minha Rotina',
      short_name: 'Minha Rotina',
      description: 'Sua rotina semanal em um só lugar.',
      lang: 'pt-BR',
      start_url: '/',
      display: 'standalone',
      background_color: '#f6f8f5',
      theme_color: '#17352d',
      icons: [
        { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
        { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
      ],
    },
    workbox: {
      globPatterns: ['**/*.{js,css,html,ico,png,svg,webmanifest}'],
      navigateFallback: null,
      runtimeCaching: [],
    },
  })],
})
