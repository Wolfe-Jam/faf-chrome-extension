/**
 * Vite Configuration - Popup Build (IIFE)
 */

import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { resolve } from 'path';

export default defineConfig({
  plugins: [
    svelte()
  ],

  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
      '@/core': resolve(__dirname, 'src/core'),
      '@/adapters': resolve(__dirname, 'src/adapters'),
      '@/ui': resolve(__dirname, 'src/ui'),
      '@/background': resolve(__dirname, 'src/background'),
    }
  },

  build: {
    lib: {
      entry: resolve(__dirname, 'src/ui/popup.ts'),
      formats: ['iife'],
      name: 'FAFPopup',
      fileName: () => 'popup.js',
    },
    outDir: 'dist',
    emptyOutDir: false,
    sourcemap: false,
    minify: true,
    target: 'chrome110',
    rollupOptions: {
      external: ['chrome'],
      output: {
        globals: {
          chrome: 'chrome'
        }
      }
    }
  },

  esbuild: {
    target: 'chrome110'
  }
});