import { defineConfig } from 'vite'

export default defineConfig({
  server: {
    proxy: {
      // Vite serves the client only. Forward local AI requests to the deployed
      // Cloudflare Pages Function so the UI does not receive a local 404.
      '/api': {
        target: 'https://ipl-legends.pages.dev',
        changeOrigin: true,
      },
    },
  },
})
