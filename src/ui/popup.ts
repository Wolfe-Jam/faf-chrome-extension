/**
 * Popup entry point - Mounts optimized Svelte component with stores
 */

import Popup from './popup-simple.svelte';

// Mount the Svelte app to the popup container
const appElement = document.getElementById('app');
if (!appElement) {
  throw new Error('App container not found');
}

const app = new Popup({
  target: appElement,
  props: {}
});

export default app;