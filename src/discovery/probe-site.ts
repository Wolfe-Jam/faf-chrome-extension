/**
 * Injected into the page (ISOLATED world) on click. Same-origin reads only,
 * so no host permission is needed. The popup reads the result back with a second call.
 */

import { runChecks } from '@/core/discovery';

(globalThis as Record<string, unknown>).__fafAgentDiscoverySite = runChecks(
  { origin: location.origin, fetch: fetch.bind(globalThis) },
  location.href
);
