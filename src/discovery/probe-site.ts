/**
 * Injected into the page (ISOLATED world) on click. Same-origin reads only,
 * so no host permission is needed. The popup reads the result back with a second call.
 */

import { pageOrigin, runChecks } from '@/core/discovery';
import { makeCheckSite } from './check-site';

const pageFetch = fetch.bind(globalThis);

const origin = pageOrigin(location);

(globalThis as Record<string, unknown>).__fafAgentDiscoverySite = runChecks(
  {
    origin,
    fetch: pageFetch,
    checkSite: makeCheckSite(origin, pageFetch),
  },
  location.href
);
