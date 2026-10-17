/**
 * Vite Configuration - Agent Discovery Check (separate build, output: dist-discovery/)
 *
 * One IIFE per entry, picked by DISCOVERY_ENTRY. The popup carries the static files
 * (manifest, popup.html); the two probes are injected into pages on click.
 */

import { resolve } from 'node:path';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { defineConfig } from 'vite';

const ENTRIES = {
  popup: { entry: 'src/discovery/popup.ts', name: 'AgentDiscoveryPopup', file: 'popup.js' },
  'probe-site': {
    entry: 'src/discovery/probe-site.ts',
    name: 'AgentDiscoveryProbeSite',
    file: 'probe-site.js',
  },
  'probe-webmcp': {
    entry: 'src/discovery/probe-webmcp.ts',
    name: 'AgentDiscoveryProbeWebMcp',
    file: 'probe-webmcp.js',
  },
} as const;

const key = (process.env.DISCOVERY_ENTRY ?? 'popup') as keyof typeof ENTRIES;
const entry = ENTRIES[key];
if (!entry) throw new Error(`Unknown DISCOVERY_ENTRY: ${key}`);

export default defineConfig({
  // CSS goes inside the popup bundle: no style.css to forget in the manifest.
  plugins: [svelte({ compilerOptions: { css: 'injected' } })],
  resolve: { alias: { '@': resolve(__dirname, 'src') } },
  publicDir: key === 'popup' ? 'public-discovery' : false,
  build: {
    lib: {
      entry: resolve(__dirname, entry.entry),
      formats: ['iife'],
      name: entry.name,
      fileName: () => entry.file,
    },
    outDir: 'dist-discovery',
    emptyOutDir: false,
    sourcemap: false,
    minify: true,
    target: 'chrome110',
  },
  define: { 'process.env.NODE_ENV': JSON.stringify('production') },
});
