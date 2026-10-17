/**
 * Injected into the page (ISOLATED world) on click. Same-origin reads only,
 * so no host permission is needed. The popup reads the result back with a second call.
 */

import { runChecks } from '@/core/discovery';
import { makeCheckSite } from './check-site';

const pageFetch = fetch.bind(globalThis);

(globalThis as Record<string, unknown>).__fafAgentDiscoverySite = runChecks(
  {
    origin: location.origin,
    fetch: pageFetch,
    checkSite: makeCheckSite(location.origin, pageFetch),
  },
  location.href
);
