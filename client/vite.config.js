import path from 'path';
import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import checker from 'vite-plugin-checker'

export default defineConfig(() => {
  return {
    server: {
      proxy: {
        '/api': {
          target: 'http://django:8000/',
          changeOrigin: true,
          secure: false,      
          ws: true,
          // rewrite: (path) => path.replace(/^\/api/, ''),
        },   
      },
    },
    build: {
      outDir: 'build',
      rollupOptions: {
        output: {
          assetFileNames: 'static/[name]-[hash][extname]',
          chunkFileNames: 'static/[name]-[hash][extname]',
          entryFileNames: 'static/[name]-[hash][extname]',
        },
      },
    },
    resolve: {
      alias: {
        'components': fileURLToPath(new URL('./src/components', import.meta.url)),
        'hooks': fileURLToPath(new URL('./src/hooks', import.meta.url)),
        'navigation': fileURLToPath(new URL('./src/navigation', import.meta.url)),
        'pages': fileURLToPath(new URL('./src/pages', import.meta.url)),
        'store': fileURLToPath(new URL('./src/store', import.meta.url)),
        'utils': fileURLToPath(new URL('./src/utils', import.meta.url)),
        '~bootstrap': path.resolve(__dirname, 'node_modules/bootstrap'),
      }
    },
    plugins: [
      react(),
      checker({
        typescript: true,
        eslint: {
          // for example, lint .ts and .tsx
          lintCommand: 'eslint "./src/**/*.{ts,tsx}"',
        },
      }),
    ],
  };
});
