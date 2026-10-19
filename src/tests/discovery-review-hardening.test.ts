/**
 * Agent Discovery Check - fixes from the independent review (2026-10-19).
 *
 * F1  redirects are never followed (a redirect can leave the origin guard behind)
 * F2  a page whose WebMCP listing never resolves cannot hang the popup
 * F3  the Referer other hosts see is the page origin, whatever the page's own policy
 * F4  only GET, HEAD and OPTIONS ever leave the extension
 */

import { type Server, createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { SERVER_CARD_TYPE, probeCatalog, probeGithub, probeLlmsTxt } from '@/core/discovery';
import { makeCheckSite, readOnlyFetch } from '@/discovery/check-site';
import { type ScriptingApi, discoverTab } from '@/discovery/run';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

let a: Server;
let b: Server;
let oa = '';
let ob = '';
const hitsB: string[] = [];
let pageHandler: (url: string) => { status: number; type?: string; body?: string; to?: string };

const CARD = {
  $schema: 'https://static.modelcontextprotocol.io/schemas/v1/server-card.schema.json',
  name: 'com.example/x',
  version: '1.0.0',
  description: 'x',
  remotes: [{ type: 'streamable-http', url: 'https://example.com/mcp' }],
};

beforeAll(async () => {
  b = createServer((req, res) => {
    hitsB.push(`${req.method} ${req.url}`);
    res.writeHead(200, { 'content-type': 'text/plain' });
    res.end('# other host\n');
  });
  await new Promise<void>((r) => b.listen(0, '127.0.0.1', r));
  ob = `http://127.0.0.1:${(b.address() as AddressInfo).port}`;
  a = createServer((req, res) => {
    const r = pageHandler(req.url ?? '');
    if (r.to) res.writeHead(r.status, { location: r.to });
    else res.writeHead(r.status, { 'content-type': r.type ?? 'text/plain' });
    res.end(r.body ?? '');
  });
  await new Promise<void>((r) => a.listen(0, '127.0.0.1', r));
  oa = `http://127.0.0.1:${(a.address() as AddressInfo).port}`;
});

afterAll(() => {
  a.closeAllConnections();
  b.closeAllConnections();
  a.close();
  b.close();
});

const redirectTo = (path: string) => ({ status: 302, to: `${ob}/hop${path}` });

describe('F1: a redirect is never followed', () => {
  it('llms.txt, the catalog and a GitHub-style HEAD that redirect read Unreadable and reach nobody', async () => {
    hitsB.length = 0;
    pageHandler = (u) => redirectTo(u);
    const llms = await probeLlmsTxt({ origin: oa, fetch });
    const [catalog] = await probeCatalog({ origin: oa, fetch });
    const gh = await probeGithub({ origin: oa, fetch }, 'https://github.com/o/r');
    expect(hitsB).toEqual([]);
    for (const r of [llms, catalog, ...gh]) {
      expect(r.status).toBe('unreadable');
      expect(r.detail).toMatch(/redirect/i);
    }
  });

  it('catalog entries on the page origin that redirect elsewhere reach nobody, and the link check says why', async () => {
    hitsB.length = 0;
    pageHandler = (u) => {
      if (u === '/.well-known/ai-catalog.json')
        return {
          status: 200,
          type: 'application/ai-catalog+json',
          body: JSON.stringify({
            specVersion: '1.0',
            entries: [
              { identifier: 'urn:air:x:mcp:card', type: SERVER_CARD_TYPE, url: `${oa}/card` },
              ...Array.from({ length: 28 }, (_, i) => ({
                identifier: `urn:air:x:mcp:e${i}`,
                type: SERVER_CARD_TYPE,
                url: `${oa}/e${i}`,
              })),
            ],
          }),
        };
      if (u === '/card') return { status: 200, type: SERVER_CARD_TYPE, body: JSON.stringify(CARD) };
      return redirectTo(u);
    };
    const checks = await makeCheckSite(
      oa,
      fetch
    )({
      cardUrl: `${oa}/card`,
      catalogUrl: `${oa}/.well-known/ai-catalog.json`,
    });
    expect(hitsB).toEqual([]);
    const links = checks.find((c) => c.id === 'catalog.links');
    expect(links?.status).toBe('skip');
    expect(links?.detail).toMatch(/redirect/i);
    expect(checks.find((c) => c.id === 'card.schema-valid')?.status).toBe('pass');
  });

  it('a Server Card URL that itself redirects is not followed; its checks are Skipped, not failed', async () => {
    hitsB.length = 0;
    pageHandler = (u) => {
      if (u === '/.well-known/ai-catalog.json')
        return { status: 200, type: 'application/ai-catalog+json', body: '{"entries":[]}' };
      return redirectTo(u);
    };
    const checks = await makeCheckSite(
      oa,
      fetch
    )({
      cardUrl: `${oa}/card`,
      catalogUrl: `${oa}/.well-known/ai-catalog.json`,
    });
    expect(hitsB).toEqual([]);
    const card = checks.filter((c) => c.tier === 'card' || c.tier === 'hosting');
    expect(card.length).toBeGreaterThan(0);
    for (const c of card) {
      expect(c.status).toBe('skip');
      expect(c.detail).toMatch(/redirect/i);
    }
  });
});

describe('F3: the referrer is the page origin, whatever the page says', () => {
  it('probe requests carry referrerPolicy "origin"', async () => {
    const inits: RequestInit[] = [];
    const spy = ((_u: unknown, init?: RequestInit) => {
      inits.push(init ?? {});
      return Promise.resolve(new Response('', { status: 404 }));
    }) as typeof fetch;
    await probeCatalog({ origin: 'https://example.com', fetch: spy });
    await probeLlmsTxt({ origin: 'https://example.com', fetch: spy });
    expect(inits.length).toBe(2);
    for (const i of inits) expect(i.referrerPolicy).toBe('origin');
  });

  it('the checker library cannot opt out: readOnlyFetch sets it last', async () => {
    const inits: RequestInit[] = [];
    const spy = ((_u: unknown, init?: RequestInit) => {
      inits.push(init ?? {});
      return Promise.resolve(new Response('', { status: 200 }));
    }) as typeof fetch;
    await readOnlyFetch(spy)('https://x.test/a', { referrerPolicy: 'unsafe-url' });
    expect(inits[0].referrerPolicy).toBe('origin');
    expect(inits[0].credentials).toBe('omit');
    expect(inits[0].redirect).toBe('manual');
  });
});

describe('F4: only GET, HEAD and OPTIONS leave the extension', () => {
  const ok = (() => Promise.resolve(new Response('', { status: 200 }))) as typeof fetch;

  it.each(['POST', 'PUT', 'PATCH', 'DELETE', 'post'])('%s is refused', async (method) => {
    await expect(readOnlyFetch(ok)('https://x.test/', { method })).rejects.toThrow('read-only');
  });

  it('a Request object cannot smuggle a method past the guard', async () => {
    const req = new Request('https://x.test/', { method: 'POST', body: 'x' });
    await expect(readOnlyFetch(ok)(req)).rejects.toThrow('read-only');
  });

  it.each(['GET', 'HEAD', 'OPTIONS'])(
    '%s is allowed (the checker needs OPTIONS for the preflight)',
    async (method) => {
      await expect(readOnlyFetch(ok)('https://x.test/', { method })).resolves.toBeInstanceOf(
        Response
      );
    }
  );
});

describe('F2: a page that never lists its WebMCP tools cannot hang the popup', () => {
  const siteRows = {
    origin: 'https://example.com',
    pageUrl: 'https://example.com/',
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

  it('returns the site rows and an Unreadable WebMCP row after the deadline', async () => {
    const api: ScriptingApi = {
      executeScript: async (inj) => {
        if (inj.files) return [{}];
        if (inj.world === 'MAIN') return new Promise(() => undefined); // the page never answers
        return [{ result: siteRows }];
      },
    };
    const t0 = Date.now();
    const run = await discoverTab({ id: 1, url: 'https://example.com/' }, api, {
      webmcpTimeoutMs: 50,
    });
    expect(Date.now() - t0).toBeLessThan(2000);
    expect(run.ok).toBe(true);
    if (run.ok) {
      const w = run.report.rows.find((r) => r.id === 'webmcp');
      expect(w?.status).toBe('unreadable');
      expect(w?.detail).toMatch(/in time/i);
    }
  });
});
