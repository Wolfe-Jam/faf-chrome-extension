/**
 * Vite Configuration - Production Chrome Extension Build
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
      '@/tests': resolve(__dirname, 'src/tests')
    }
  },

  // This config is now only used for development server
  build: {
    outDir: 'dist',
    emptyOutDir: false
  },

  // Development server (for testing components)
  server: {
    port: 3000,
    open: false
  },

  // CSS handling
  css: {
    modules: false,
    postcss: {
      plugins: []
    }
  },

  // Environment variables
  define: {
    'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV || 'development'),
    '__DEV__': JSON.stringify(process.env.NODE_ENV !== 'production')
  }
});