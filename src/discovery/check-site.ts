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
// One click may cause at most this many requests, whatever the site's catalog lists.
export const MAX_REQUESTS = 30;

export function readOnlyFetch(base: typeof fetch): typeof fetch {
  return (input, init) =>
    (init?.method ?? 'GET').toUpperCase() === 'POST'
      ? Promise.reject(new Error('read-only: no POST from the extension'))
      : base(input, { ...init, credentials: 'omit' });
}

/**
 * Limits what a site's catalog can make the extension fetch: only the page's own origin and
 * the origin of the Server Card being checked, and no more than MAX_REQUESTS in all. Anything
 * else is refused before it leaves the browser and recorded in `refused`.
 */
export function boundedFetch(base: typeof fetch, allowed: string[], max = MAX_REQUESTS) {
  const refused: string[] = [];
  let sent = 0;
  const bounded = ((input, init) => {
    const url = String(input instanceof Request ? input.url : input);
    let origin = '';
    try {
      origin = new URL(url).origin;
    } catch {
      /* unparseable: refused below */
    }
    if (!allowed.includes(origin) || sent >= max) {
      refused.push(url);
      return Promise.reject(new Error('refused: outside what this check may read'));
    }
    sent++;
    return base(input, init);
  }) as typeof fetch;
  return { fetch: bounded, refused };
}

export function makeCheckSite(pageOrigin: string, base: typeof fetch, timeoutMs = 8000) {
  return async ({
    cardUrl,
    catalogUrl,
  }: { cardUrl: string; catalogUrl: string }): Promise<SpecCheck[]> => {
    const crossOrigin = new URL(cardUrl).origin !== pageOrigin;
    const bounded = boundedFetch(readOnlyFetch(base), [pageOrigin, new URL(cardUrl).origin]);
    const report = await checkDiscovery(
      { mcpUrl: cardUrl.replace(/\/server-card\/?$/, ''), cardUrl, catalogUrl },
      { fetch: bounded.fetch, validateCard, rawStatus: async () => null, timeoutMs }
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
        if (r.id === 'catalog.links' && bounded.refused.length) {
          check.status = 'skip';
          check.detail = `${bounded.refused.length} entry URL${bounded.refused.length === 1 ? ' is' : 's are'} on other hosts or over the ${MAX_REQUESTS}-request limit, so they were not requested; check them on ${WEB_CHECKER}`;
        }
        return check;
      });
  };
}
