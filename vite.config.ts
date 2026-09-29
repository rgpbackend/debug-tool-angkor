import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

import { cloudflare } from "@cloudflare/vite-plugin";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), cloudflare()],
  server: {
    host: true,
    allowedHosts: true,
    // Agency 401/409 omit CORS headers; same-origin proxy keeps those statuses readable in the UI.
    proxy: {
      "/agency-api": {
        target: "https://agency001.relaxwmestu.xyz",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/agency-api/, "/api/v1"),
      },
      "/auth-refresh": {
        target: "https://authentication.relaxwmestu.xyz",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/auth-refresh/, "/api/auth/refresh"),
      },
    },
  },
})