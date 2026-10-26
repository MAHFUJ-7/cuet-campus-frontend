import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// The API base URL can be overridden with VITE_API_BASE_URL (see .env.example).
// By default the app calls `/api/v1/...` on its own origin; in dev this is
// proxied to the campus backend so no CORS configuration is needed locally.
export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: {
    rollupOptions: {
      output: {
        // Keep Leaflet (used only by the Campus Map) out of the main bundle,
        // and cache the framework separately from app code. Rolldown (Vite 8)
        // requires the function form.
        manualChunks(id) {
          const path = id.replace(/\\/g, '/');
          if (path.includes('node_modules/leaflet')) return 'leaflet';
          if (
            /node_modules\/(react|react-dom|react-router|react-router-dom|scheduler)\//.test(path)
          ) {
            return 'react';
          }
          return undefined;
        },
      },
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
      // Health endpoint used by the Dev Debug screen.
      '/health': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
});
