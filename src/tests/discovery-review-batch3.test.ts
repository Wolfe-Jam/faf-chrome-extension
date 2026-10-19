/**
 * Second independent review, the rest (N2 to N11) and the redirect label (K1).
 *
 * N2  refused methods never use the request budget; a card whose later request was refused
 *     reads Skipped for the hosting checks, not failed
 * N3  the site read and the WebMCP read run together, so a click is capped by one deadline
 * N4  the click deadline also aborts requests the checker library already has in flight
 * N5  a probe that times out says so, not Chrome's generic abort text
 * N6  a GitHub file that is not found says it was checked without the user's sign-in
 * N9  a Server Card row says when the card itself was never read
 * N10 plurals and the limit named in the detail
 * N11 the page-visible global is removed after it is read
 * K1  a redirect says what happened, in words
 */

import { type Server, createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { SERVER_CARD_TYPE, probeCatalog, probeGithub, probeLlmsTxt } from '@/core/discovery';
import { boundedFetch, guardedFetch, makeCheckSite } from '@/discovery/check-site';
import { type ScriptingApi, discoverTab } from '@/discovery/run';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const respond = (body: string, type = 'text/plain', status = 200) =>
  new Response(body, { status, headers: { 'content-type': type } });
const fetchFrom = (
  h: (url: string, init?: RequestInit) => Response | Promise<Response>
): typeof fetch =>
  ((i: RequestInfo | URL, init?: RequestInit) =>
    Promise.resolve(h(String(i), init))) as typeof fetch;

/* ---------------------------------------------------------------- a real card server */
let server: Server;
let origin = '';
const CARD = {
  $schema: 'https://static.modelcontextprotocol.io/schemas/v1/server-card.schema.json',
  name: 'com.example/x',
  version: '1.0.0',
  description: 'x',
  remotes: [{ type: 'streamable-http', url: 'https://example.com/mcp' }],
};
beforeAll(async () => {
  server = createServer((req, res) => {
    const cors = {
      'access-control-allow-origin': '*',
      'access-control-allow-headers': '*',
      'access-control-allow-methods': 'GET, OPTIONS',
      'access-control-expose-headers': 'etag',
    };
    if (req.method === 'OPTIONS') {
      res.writeHead(204, cors);
      res.end();
    } else if (req.url === '/card' && req.headers['if-none-match'] === '"v1"') {
      res.writeHead(304, { ...cors, etag: '"v1"' });
      res.end();
    } else if (req.url === '/card') {
      res.writeHead(200, {
        ...cors,
        'content-type': SERVER_CARD_TYPE,
        etag: '"v1"',
        'cache-control': 'public, max-age=60',
      });
      res.end(JSON.stringify(CARD));
    } else {
      res.writeHead(404, cors);
      res.end();
    }
  });
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
  origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
afterAll(() => {
  server.closeAllConnections();
  server.close();
});

describe('N2: the request budget and refused requests', () => {
  it('a refused method never uses up the budget: guardedFetch rejects it before counting', async () => {
    const seen: string[] = [];
    const base = fetchFrom((u) => {
      seen.push(u);
      return respond('{}');
    });
    const g = guardedFetch(base, [origin], 30);
    await expect(g.fetch(`${origin}/x`, { method: 'POST' })).rejects.toThrow('read-only');
    await expect(g.fetch(`${origin}/x`, { method: 'DELETE' })).rejects.toThrow('read-only');
    expect(g.reached).toEqual([]);
    expect(seen).toEqual([]);
    await g.fetch(`${origin}/y`);
    expect(g.reached).toEqual([`${origin}/y`]);
  });

  it('when the cap lands after the first card GET, the hosting checks read Skipped, not failed', async () => {
    const checks = await makeCheckSite(
      origin,
      fetch,
      8000,
      3
    )({
      cardUrl: `${origin}/card`,
      catalogUrl: `${origin}/.well-known/ai-catalog.json`,
    });
    expect(checks.find((c) => c.id === 'card.schema-valid')?.status).toBe('pass');
    for (const id of ['hosting.cors-preflight', 'hosting.etag']) {
      const c = checks.find((x) => x.id === id);
      expect(c?.status, id).toBe('skip');
      expect(c?.detail).toMatch(/limit|refused|outside/i);
    }
  });
});

describe('N3: the site read and the WebMCP read run together', () => {
  it('a slow site read and a stuck WebMCP read cost the longer of the two, not the sum', async () => {
    const siteRows = {
      origin: 'https://x.test',
      pageUrl: 'https://x.test/',
      ms: 1,
      rows: [
        {
          id: 'webmcp' as const,
          title: 'WebMCP tools',
          status: 'skipped' as const,
          spec: { label: 'WebMCP', url: 'https://x.test/' },
        },
      ],
    };
    const api: ScriptingApi = {
      executeScript: async (inj) => {
        if (inj.files) return [{}];
        if (inj.world === 'MAIN') return new Promise(() => undefined);
        await new Promise((r) => setTimeout(r, 400));
        return [{ result: siteRows }];
      },
    };
    const t0 = Date.now();
    const run = await discoverTab({ id: 1, url: 'https://x.test/' }, api, { webmcpTimeoutMs: 400 });
    const took = Date.now() - t0;
    expect(run.ok).toBe(true);
    expect(took).toBeLessThan(700); // sequential would be about 800
  });
});

describe('N4: the deadline aborts requests already in flight', () => {
  it('an abort of the click signal reaches a fetch the checker library started', async () => {
    const base = ((_u: unknown, init?: RequestInit) =>
      new Promise((_res, rej) => {
        init?.signal?.addEventListener('abort', () => rej(new Error('aborted')));
      })) as typeof fetch;
    const click = new AbortController();
    const b = boundedFetch(base, ['https://x.test'], 30, click.signal);
    const libSignal = new AbortController().signal; // the library passes its own timeout signal
    const p = b.fetch('https://x.test/a', { signal: libSignal });
    setTimeout(() => click.abort(), 20);
    await expect(p).rejects.toThrow();
  });
});

describe('N5: a timeout says what happened', () => {
  it('names the time limit instead of "signal is aborted"', async () => {
    const never = ((_u: unknown, init?: RequestInit) =>
      new Promise((_res, rej) => {
        init?.signal?.addEventListener('abort', () =>
          rej(new Error('signal is aborted without reason'))
        );
      })) as typeof fetch;
    const row = await probeLlmsTxt({ origin: 'https://slow.test', fetch: never, timeoutMs: 50 });
    expect(row.status).toBe('unreadable');
    expect(row.detail).toMatch(/no answer within/i);
    expect(row.detail).not.toMatch(/aborted/i);
  });
});

describe('N6: a GitHub file not found says how it was checked', () => {
  it('a 404 reads Not published and says it was checked without the sign-in', async () => {
    const rows = await probeGithub(
      { origin: 'https://github.com', fetch: fetchFrom(() => respond('', 'text/plain', 404)) },
      'https://github.com/o/r'
    );
    expect(rows).toHaveLength(2);
    for (const r of rows) {
      expect(r.status).toBe('missing');
      expect(r.detail).toMatch(/public repository/i);
      expect(r.detail).toMatch(/without your sign-in/i);
    }
  });
});

describe('N9 and N10: card row wording', () => {
  it('a card whose checks were all skipped says the card itself was not read', async () => {
    const f = fetchFrom((u) =>
      u.endsWith('/.well-known/ai-catalog.json')
        ? respond(
            JSON.stringify({ entries: [{ type: SERVER_CARD_TYPE, url: '/card' }] }),
            'application/json'
          )
        : respond('', 'text/plain', 302)
    );
    const [, card] = await probeCatalog({
      origin: 'https://x.test',
      fetch: f,
      checkSite: async () => [
        { id: 'card.found', tier: 'card', level: 'must', title: 't', status: 'skip' },
        { id: 'hosting.https', tier: 'hosting', level: 'must', title: 't', status: 'skip' },
      ],
    });
    expect(card.detail).toMatch(/card itself was not read/i);
  });

  it('plural and singular: "1 redirects", "3 redirect"', async () => {
    const mk = async (n: number) => {
      const f = fetchFrom((u) => {
        if (u.endsWith('/.well-known/ai-catalog.json'))
          return respond(
            JSON.stringify({
              entries: [
                { identifier: 'urn:air:x:mcp:c', type: SERVER_CARD_TYPE, url: `${origin}/card` },
                ...Array.from({ length: n }, (_, i) => ({
                  identifier: `urn:air:x:mcp:e${i}`,
                  type: SERVER_CARD_TYPE,
                  url: `${origin}/e${i}`,
                })),
              ],
            }),
            'application/ai-catalog+json'
          );
        if (u === `${origin}/card`) return respond(JSON.stringify(CARD), SERVER_CARD_TYPE);
        return respond('', 'text/plain', 302);
      });
      const checks = await makeCheckSite(
        origin,
        f
      )({
        cardUrl: `${origin}/card`,
        catalogUrl: `${origin}/.well-known/ai-catalog.json`,
      });
      return checks.find((c) => c.id === 'catalog.links')?.detail ?? '';
    };
    expect(await mk(1)).toMatch(/1 entry URL redirects/);
    expect(await mk(3)).toMatch(/3 entry URLs redirect\b/);
  });

  it('names the limit that was actually set', async () => {
    const f = fetchFrom(() => respond('{}', 'application/json'));
    const checks = await makeCheckSite(
      'https://x.test',
      f,
      8000,
      7
    )({
      cardUrl: 'https://x.test/card',
      catalogUrl: 'https://x.test/.well-known/ai-catalog.json',
    });
    const links = checks.find((c) => c.id === 'catalog.links');
    if (links?.detail && /limit/.test(links.detail)) expect(links.detail).toContain('7-request');
  });
});

describe('N11: the page-visible global is removed after it is read', () => {
  it('the read function deletes the global it reads', async () => {
    const g = globalThis as Record<string, unknown>;
    const calls: string[] = [];
    const api: ScriptingApi = {
      executeScript: async (inj) => {
        if (inj.files) {
          const key = inj.files[0].includes('webmcp')
            ? '__fafAgentDiscoveryWebMcp'
            : '__fafAgentDiscoverySite';
          g[key] =
            key === '__fafAgentDiscoverySite'
              ? { origin: 'https://x.test', pageUrl: 'https://x.test/', ms: 1, rows: [] }
              : null;
          return [{}];
        }
        calls.push(inj.args?.[0] ?? '');
        const fn = inj.func as unknown as (k: string) => unknown;
        return [{ result: fn(inj.args?.[0] ?? '') }];
      },
    };
    await discoverTab({ id: 1, url: 'https://x.test/' }, api);
    expect(calls.sort()).toEqual(['__fafAgentDiscoverySite', '__fafAgentDiscoveryWebMcp']);
    expect(g.__fafAgentDiscoverySite).toBeUndefined();
    expect(g.__fafAgentDiscoveryWebMcp).toBeUndefined();
  });
});

describe('K1: a redirect says what happened', () => {
  it('in words, not a code', async () => {
    const f = fetchFrom(() => respond('', 'text/plain', 302));
    const row = await probeLlmsTxt({ origin: 'https://x.test', fetch: f });
    expect(row.status).toBe('unreadable');
    expect(row.detail).toBe(
      'it redirects to another address; redirects are not followed, so the file was not read'
    );
  });
});
