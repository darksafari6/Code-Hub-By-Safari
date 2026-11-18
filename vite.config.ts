import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';
import { defineConfig } from 'vite';

/**
 * When the Python API runs on its own port (see scripts/dev.sh), the Vite dev
 * server proxies the API, preview and websocket traffic to it. The Node server
 * shares one port with Vite instead, so the proxy is opt-in via the environment.
 */
const apiProxy = process.env.SAFARI_API_PROXY;

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(process.cwd(), 'src'),
    },
  },
  server: {
    host: '0.0.0.0',
    port: Number(process.env.PORT ?? 3000),
    allowedHosts: true,
    ...(apiProxy
      ? {
          proxy: {
            '/api': { target: apiProxy, changeOrigin: true },
            '/preview': { target: apiProxy, changeOrigin: true },
            '/ws': { target: apiProxy, ws: true, changeOrigin: true },
          },
        }
      : {}),
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    chunkSizeWarningLimit: 2048,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/monaco-editor')) return 'monaco';
          if (id.includes('node_modules/@xterm')) return 'xterm';
          if (
            id.includes('node_modules/react-dom') ||
            id.includes('node_modules/react/') ||
            id.includes('node_modules/scheduler')
          ) {
            return 'react';
          }
          return undefined;
        },
      },
    },
  },
});
