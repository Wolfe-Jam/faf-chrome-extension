/**
 * Vite Configuration - Production Chrome Extension Build
 */

import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

export default defineConfig({
  plugins: [
    react({
      jsxRuntime: 'automatic'
    })
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

  build: {
    outDir: 'dist',
    emptyOutDir: false, // Keep manifest.json and icons
    sourcemap: process.env.NODE_ENV !== 'production',
    minify: process.env.NODE_ENV === 'production',
    target: 'chrome110', // Chrome extension target
    
    rollupOptions: {
      input: {
        // Main extension files
        'service-worker': resolve(__dirname, 'src/background/service-worker.ts'),
        'content': resolve(__dirname, 'src/ui/content.ts'),
        'popup': resolve(__dirname, 'src/ui/popup.tsx'),
        
        // HTML entry point
        'popup-html': resolve(__dirname, 'public/popup.html')
      },
      
      output: {
        entryFileNames: (chunkInfo) => {
          // Custom naming for different entry types
          if (chunkInfo.name === 'service-worker') {
            return 'service-worker.js';
          }
          if (chunkInfo.name === 'content') {
            return 'content.js';
          }
          if (chunkInfo.name === 'popup') {
            return 'popup.js';
          }
          return '[name].js';
        },
        
        chunkFileNames: 'chunks/[name].[hash].js',
        assetFileNames: (assetInfo) => {
          // Handle CSS files
          if (assetInfo.name?.endsWith('.css')) {
            return '[name].css';
          }
          return 'assets/[name].[ext]';
        },
        
        // No code splitting for Chrome extension
        manualChunks: undefined
      },
      
      external: [
        // Chrome APIs are provided by the browser
        'chrome'
      ]
    }
  },

  // Optimize for Chrome extension
  optimizeDeps: {
    exclude: ['chrome']
  },

  // Development server (for testing components)
  server: {
    port: 3000,
    open: false // Don't auto-open browser
  },

  // CSS handling
  css: {
    modules: false, // We use regular CSS
    postcss: {
      plugins: [
        // Add PostCSS plugins if needed
      ]
    }
  },

  // Environment variables
  define: {
    'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV || 'development'),
    '__DEV__': JSON.stringify(process.env.NODE_ENV !== 'production')
  },

  // Ensure proper ES modules for service worker
  esbuild: {
    target: 'chrome110',
    format: 'esm'
  }
});