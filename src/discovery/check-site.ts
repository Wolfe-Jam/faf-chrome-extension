/**
 * Spec checks for one Server Card and its catalog, run in the page with mcp-server-card-check.
 *
 * Read-only: the fetch refuses POST and there is no raw socket, so the transport and
 * consistency tiers never run (they are dropped here). Reads go out from the page, so a
 * card on another origin is read under CORS: its response headers mostly can't be seen
 * from here, and the header checks on it would fail for the wrong reason. Those report
 * "skip" with a pointer to the web checker, which reads them server-side.
 */

import type { SpecCheck } from '@/core/discovery';
import { SPEC_REFS, checkDiscovery, validateCard } from 'mcp-server-card-check/browser';

const WEB_CHECKER = 'servercard.wolfejam.dev';
// Headers a page can't read on a cross-origin response unless the server exposes them.
const HEADER_CHECKS = /^hosting\.(cors-|etag)/;

export function readOnlyFetch(base: typeof fetch): typeof fetch {
  return (input, init) =>
    (init?.method ?? 'GET').toUpperCase() === 'POST'
      ? Promise.reject(new Error('read-only: no POST from the extension'))
      : base(input, { ...init, credentials: 'omit' });
}

export function makeCheckSite(pageOrigin: string, base: typeof fetch, timeoutMs = 8000) {
  return async ({
    cardUrl,
    catalogUrl,
  }: { cardUrl: string; catalogUrl: string }): Promise<SpecCheck[]> => {
    const crossOrigin = new URL(cardUrl).origin !== pageOrigin;
    const report = await checkDiscovery(
      { mcpUrl: cardUrl.replace(/\/server-card\/?$/, ''), cardUrl, catalogUrl },
      { fetch: readOnlyFetch(base), validateCard, rawStatus: async () => null, timeoutMs }
    );
    return report.results
      .filter((r) => r.tier === 'card' || r.tier === 'hosting' || r.tier === 'catalog')
      .map((r) => {
        const check: SpecCheck = {
          id: r.id,
          tier: r.tier as SpecCheck['tier'],
          level: r.level,
          title: r.title,
          status: r.status,
          ...(r.detail ? { detail: r.detail } : {}),
          ...(SPEC_REFS[r.id] ? { spec: SPEC_REFS[r.id] } : {}),
        };
        if (crossOrigin && HEADER_CHECKS.test(r.id)) {
          check.status = 'skip';
          check.detail = `the card is on another origin, so its headers can't be read from this page; check it on ${WEB_CHECKER}`;
        }
        return check;
      });
  };
}
