/**
 * Spec checks for one Server Card and its catalog, run in the page with mcp-server-card-check.
 *
 * Read-only: the fetch refuses POST and there is no raw socket, so the transport and
 * consistency tiers never run (they are dropped here). Reads go out from the page, so a
 * card on another origin is read under CORS: its response headers mostly can't be seen
 * from here, and the header checks on it would fail for the wrong reason. Those report
 * "skip" with a pointer to the web checker, which reads them server-side.
 */

import { type SpecCheck, isRedirect } from '@/core/discovery';
import { SPEC_REFS, checkDiscovery, validateCard } from 'mcp-server-card-check/browser';

const WEB_CHECKER = 'servercard.wolfejam.dev';
// Headers a page can't read on a cross-origin response unless the server exposes them.
const HEADER_CHECKS = /^hosting\.(cors-|etag)/;
// One click may cause at most this many requests, whatever the site's catalog lists.
export const MAX_REQUESTS = 30;

/** Only these methods ever leave the extension. OPTIONS is the checker's CORS preflight check. */
const ALLOWED_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

export function readOnlyFetch(base: typeof fetch): typeof fetch {
  return (input, init) => {
    const method = (
      init?.method ?? (input instanceof Request ? input.method : 'GET')
    ).toUpperCase();
    if (!ALLOWED_METHODS.has(method))
      return Promise.reject(new Error(`read-only: no ${method} from the extension`));
    // Set last so nothing the checker passes can undo them: no cookies, no redirects (a redirect
    // can leave the origin limits behind), and other hosts see only the page origin.
    return base(input, {
      ...init,
      credentials: 'omit',
      redirect: 'manual',
      referrerPolicy: 'origin',
    });
  };
}

/**
 * Limits what a site's catalog can make the extension fetch: only the page's own origin and
 * the origin of the Server Card being checked, and no more than MAX_REQUESTS in all. Anything
 * else is refused before it leaves the browser and recorded in `refused`.
 */
/** Joins two abort signals without AbortSignal.any (Chrome 116+): aborts when either does. */
function eitherSignal(a?: AbortSignal | null, b?: AbortSignal | null): AbortSignal | undefined {
  if (!a && !b) return undefined;
  if (!a || !b) return (a ?? b) as AbortSignal;
  const ac = new AbortController();
  const stop = (from: AbortSignal) => () => ac.abort(from.reason);
  for (const sig of [a, b]) {
    if (sig.aborted) ac.abort(sig.reason);
    else sig.addEventListener('abort', stop(sig), { once: true });
  }
  return ac.signal;
}

export function boundedFetch(
  base: typeof fetch,
  allowed: string[],
  max = MAX_REQUESTS,
  signal?: AbortSignal
) {
  const refused: string[] = [];
  const redirected: string[] = [];
  const reached: string[] = [];
  let sent = 0;
  const bounded = (async (input, init) => {
    const url = String(input instanceof Request ? input.url : input);
    let origin = '';
    try {
      origin = new URL(url).origin;
    } catch {
      /* unparseable: refused below */
    }
    if (!allowed.includes(origin) || sent >= max || signal?.aborted) {
      refused.push(url);
      throw new Error('refused: outside what this check may read');
    }
    sent++;
    reached.push(url);
    // The click deadline also stops a request the checker library already started.
    const joined = eitherSignal(init?.signal, signal);
    const res = await base(input, joined ? { ...init, signal: joined } : init);
    if (isRedirect(res)) redirected.push(url);
    return res;
  }) as typeof fetch;
  return { fetch: bounded, refused, redirected, reached };
}

/**
 * The two guards in the right order. readOnlyFetch is the OUTER one, so a refused method (the
 * checker's transport tier tries POSTs) is rejected before boundedFetch counts it as a request.
 */
export function guardedFetch(
  base: typeof fetch,
  allowed: string[],
  max = MAX_REQUESTS,
  signal?: AbortSignal
) {
  const bounded = boundedFetch(base, allowed, max, signal);
  return { ...bounded, fetch: readOnlyFetch(bounded.fetch) };
}

export function makeCheckSite(
  pageOrigin: string,
  base: typeof fetch,
  timeoutMs = 8000,
  maxRequests = MAX_REQUESTS
) {
  return async ({
    cardUrl,
    catalogUrl,
    signal,
  }: { cardUrl: string; catalogUrl: string; signal?: AbortSignal }): Promise<SpecCheck[]> => {
    const crossOrigin = new URL(cardUrl).origin !== pageOrigin;
    // An opaque origin ("null", from a data: or blob: URL) is never allowed.
    const allowed = [pageOrigin, new URL(cardUrl).origin].filter((o) => o !== 'null');
    const bounded = guardedFetch(base, allowed, maxRequests, signal);
    const report = await checkDiscovery(
      { mcpUrl: cardUrl.replace(/\/server-card\/?$/, ''), cardUrl, catalogUrl },
      { fetch: bounded.fetch, validateCard, rawStatus: async () => null, timeoutMs }
    );
    const cardRedirected = bounded.redirected.includes(cardUrl);
    // Refused only counts if the card was never read: the checker asks for the card URL again later
    // (as a catalog link), and that second request can hit the cap after the card was read fine.
    const cardRefused = bounded.refused.includes(cardUrl) && !bounded.reached.includes(cardUrl);
    // A later request to the card (preflight, conditional GET) that the limit refused is not a failure.
    const laterCardRequestRefused = bounded.refused.includes(cardUrl) && !cardRefused;
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
        if ((cardRedirected || cardRefused) && (r.tier === 'card' || r.tier === 'hosting')) {
          check.status = 'skip';
          check.detail = cardRedirected
            ? `the card URL redirects, and redirects are not followed; check it on ${WEB_CHECKER}`
            : `the request limit or the origin rule stopped this check; check it on ${WEB_CHECKER}`;
        }
        if (laterCardRequestRefused && r.tier === 'hosting' && check.status === 'fail') {
          check.status = 'skip';
          check.detail = `the request limit stopped this check; check it on ${WEB_CHECKER}`;
        }
        if (r.id === 'catalog.links' && (bounded.refused.length || bounded.redirected.length)) {
          const why: string[] = [];
          const nRef = bounded.refused.length;
          const nRed = bounded.redirected.length;
          if (nRef)
            why.push(
              `${nRef} entry URL${nRef === 1 ? ' is' : 's are'} on other hosts or over the ${maxRequests}-request limit`
            );
          if (nRed)
            why.push(
              nRed === 1
                ? '1 entry URL redirects, and redirects are not followed'
                : `${nRed} entry URLs redirect, and redirects are not followed`
            );
          check.status = 'skip';
          check.detail = `${why.join('; ')}, so they were not checked; check them on ${WEB_CHECKER}`;
        }
        return check;
      });
  };
}
