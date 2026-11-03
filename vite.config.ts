import { defineConfig } from 'vitest/config';
import { loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { fileURLToPath, URL } from 'node:url';

export default defineConfig(({ mode }) => {
  const environment = loadEnv(mode, process.cwd(), 'VITE_');
  const backend =
    process.env.VITE_SUPABASE_URL || environment.VITE_SUPABASE_URL;
  const origin = backend ? new URL(backend).origin : '';
  return {
    base: process.env.BASE_PATH || '/',
    plugins: [
      react(),
      tailwindcss(),
      {
        name: 'production-security-policy',
        apply: 'build',
        transformIndexHtml() {
          return [
            {
              tag: 'meta',
              attrs: {
                'http-equiv': 'Content-Security-Policy',
                content: `default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self' ${origin}; object-src 'none'; base-uri 'self'; form-action 'self'`,
              },
              injectTo: 'head-prepend',
            },
          ];
        },
      },
    ],
    resolve: {
      alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
    },
    build: {
      rollupOptions: {
        output: {
          manualChunks: {
            react: ['react', 'react-dom', 'react-router-dom'],
            supabase: ['@supabase/supabase-js'],
            forms: ['react-hook-form', '@hookform/resolvers/zod', 'zod'],
          },
        },
      },
    },
    test: { include: ['src/**/*.test.ts'] },
  };
});
