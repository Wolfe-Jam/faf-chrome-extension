/**
 * Agent Discovery Check popup entry (Svelte 5 mount API).
 */

import { mount } from 'svelte';
import Popup from './Popup.svelte';

const target = document.getElementById('app');
if (!target) throw new Error('App container not found');

const app = mount(Popup, { target });

export default app;
