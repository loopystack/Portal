import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { '@': path.resolve(__dirname, 'src') },
  },
  server: {
    port: 3000,
    host: true, // listen on 0.0.0.0 so the app is reachable from other machines (e.g. 95.216.225.37:3000)
    allowedHosts: true,
    // Disable HMR so the app loads when opened by IP (95.216.225.37:3000); HMR WebSocket was breaking the page.
    hmr: false,
    proxy: {
      '/api': {
        target: 'http://localhost:4000',
        changeOrigin: true,
      },
    },
  },
});
