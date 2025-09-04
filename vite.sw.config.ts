// vite.sw.config.ts

import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
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
    // Tell Vite this is a library build
    lib: {
      // The entry point for your service worker
      entry: resolve(__dirname, 'src/background/service-worker.ts'),
      
      // The output format. 'iife' is a self-executing function
      // that doesn't use imports and works well in extensions.
      formats: ['iife'],
      
      // A name for the library (required for iife format)
      name: 'serviceWorker',
      
      // The final file name for the service worker
      fileName: () => 'service-worker.js',
    },
    // Make sure the output goes to your main build folder (e.g., 'dist')
    outDir: 'dist',
    
    // Set this to false so Vite doesn't delete the other files
    // in your 'dist' folder when it builds the service worker.
    emptyOutDir: false,

    // Target Chrome extension environment
    target: 'chrome110',
    minify: process.env.NODE_ENV === 'production',
    sourcemap: process.env.NODE_ENV !== 'production',

    rollupOptions: {
      external: [],
      output: {
        format: 'iife',
        globals: {
          chrome: 'chrome'
        }
      }
    }
  },

  // Environment variables
  define: {
    'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV || 'development'),
    '__DEV__': JSON.stringify(process.env.NODE_ENV !== 'production')
  },

  // Optimize for Chrome extension
  optimizeDeps: {
    exclude: ['chrome']
  }
});