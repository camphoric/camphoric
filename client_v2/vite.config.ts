import { fileURLToPath, URL } from 'node:url';

import react from '@vitejs/plugin-react';
import checker from 'vite-plugin-checker';
import { defineConfig } from 'vitest/config';

// The client talks to the Django backend at /api. In dev we proxy /api to the
// backend (default http://localhost:8000/); in production both are served from
// the same origin so no proxy is needed.
export default defineConfig({
  server: {
    proxy: {
      '/api': {
        target: process.env.VITE_API_PROXY || 'http://localhost:8000/',
        changeOrigin: true,
        secure: false,
      },
    },
  },
  build: {
    // Output matches the existing client so the deploy/Dockerfile can swap in.
    outDir: 'build',
    rollupOptions: {
      output: {
        assetFileNames: 'static/[name]-[hash][extname]',
        chunkFileNames: 'static/[name]-[hash].js',
        entryFileNames: 'static/[name]-[hash].js',
      },
    },
  },
  resolve: {
    alias: {
      'api-types': fileURLToPath(new URL('./src/api-types.ts', import.meta.url)),
      components: fileURLToPath(new URL('./src/components', import.meta.url)),
      hooks: fileURLToPath(new URL('./src/hooks', import.meta.url)),
      navigation: fileURLToPath(new URL('./src/navigation', import.meta.url)),
      pages: fileURLToPath(new URL('./src/pages', import.meta.url)),
      pricing: fileURLToPath(new URL('./src/pricing', import.meta.url)),
      store: fileURLToPath(new URL('./src/store', import.meta.url)),
      templating: fileURLToPath(new URL('./src/templating', import.meta.url)),
      utils: fileURLToPath(new URL('./src/utils', import.meta.url)),
    },
  },
  plugins: [
    react(),
    checker({
      typescript: true,
      eslint: {
        lintCommand: 'eslint "./src/**/*.{ts,tsx}"',
        useFlatConfig: true,
      },
    }),
  ],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
    css: true,
  },
});
