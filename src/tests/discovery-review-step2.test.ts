/**
 * Agent Discovery Check - second batch of review fixes (2026-10-19).
 *
 * F6  an SPA that answers 200 with its HTML shell for the catalog is "Not published", not "Unreadable"
 * F7  one click has an overall deadline; rows still running at the deadline read Unreadable
 * F8  a big WebMCP input schema is not a false MUST failure
 * F9  a page cannot flood or break the popup with its tool list (cap, keys, field lengths)
 * F14 a sandboxed page (origin "null") still resolves the real origin
 * F15 a Server Card URL that is not http(s) is not checked
 * F16 a card whose fetch was refused reads Skipped, not failed
 */

import {
  type DiscoveryReport,
  MAX_TOOLS,
  SERVER_CARD_TYPE,
  type WebMcpTool,
  pageOrigin,
  probeCatalog,
  probeWebMcp,
  runChecks,
  webMcpToolChecks,
} from '@/core/discovery';
import { makeCheckSite } from '@/discovery/check-site';
import { afterEach, describe, expect, it, vi } from 'vitest';

const respond = (body: string, type = 'text/html', status = 200) =>
  new Response(body, { status, headers: { 'content-type': type } });
const fetchFrom = (h: (url: string) => Response | Promise<Response>): typeof fetch =>
  ((i: RequestInfo | URL) => Promise.resolve(h(String(i)))) as typeof fetch;

describe('F6: an HTML shell answered for the catalog is Not published', () => {
  it('a 200 HTML page at the catalog path reads missing, not unreadable', async () => {
    const f = fetchFrom(() => respond('<!doctype html><html><body>App</body></html>'));
    const [catalog, card] = await probeCatalog({ origin: 'https://spa.test', fetch: f });
    expect(catalog.status).toBe('missing');
    expect(catalog.detail).toMatch(/web page/i);
    expect(card.status).toBe('skipped');
  });

  it('a 200 that is neither HTML nor JSON is still Unreadable', async () => {
    const f = fetchFrom(() => respond('totally not json', 'text/plain'));
    const [catalog] = await probeCatalog({ origin: 'https://x.test', fetch: f });
    expect(catalog.status).toBe('unreadable');
  });
});

describe('F7: an overall deadline per click', () => {
  it('a server that never answers cannot hold the whole click past the deadline', async () => {
    const hang = ((_u: unknown, init?: RequestInit) =>
      new Promise((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => reject(new Error('aborted')));
      })) as typeof fetch;
    const t0 = Date.now();
    const report = await runChecks(
      { origin: 'https://slow.test', fetch: hang, timeoutMs: 60_000, deadlineMs: 150 },
      'https://slow.test/'
    );
    expect(Date.now() - t0).toBeLessThan(3000);
    const catalog = report.rows.find((r) => r.id === 'ai-catalog');
    const llms = report.rows.find((r) => r.id === 'llms-txt');
    for (const r of [catalog, llms]) {
      expect(r?.status).toBe('unreadable');
      expect(r?.detail).toMatch(/ran out of time/i);
    }
  });

  it('GitHub rows read Unreadable at the deadline, even in the middle of a 429 wait', async () => {
    const limited = fetchFrom(() => respond('', 'text/plain', 429));
    const report = await runChecks(
      {
        origin: 'https://github.com',
        fetch: limited,
        deadlineMs: 150,
        sleep: () => new Promise(() => undefined), // a retry wait that never ends
      },
      'https://github.com/o/r'
    );
    const gh = report.rows.filter((r) => r.id === 'agents-md' || r.id === 'project-faf');
    expect(gh).toHaveLength(2);
    for (const r of gh) expect(r.status).toBe('unreadable');
  });

  it('a click that finishes in time is untouched by the deadline', async () => {
    const f = fetchFrom(() => respond('nope', 'text/plain', 404));
    const report = await runChecks(
      { origin: 'https://ok.test', fetch: f, deadlineMs: 5000 },
      'https://ok.test/'
    );
    expect(report.rows.find((r) => r.id === 'ai-catalog')?.status).toBe('missing');
  });
});

describe('F8: input schema checks', () => {
  const tool = (extra: Partial<WebMcpTool>): WebMcpTool => ({
    name: 'big',
    description: 'd',
    ...extra,
  });
  const schemaCheck = (t: WebMcpTool) =>
    webMcpToolChecks(t).find((c) => c.id.endsWith('.input-schema'));

  it('an object schema too large to ship whole still passes (the probe already judged it)', () => {
    const c = schemaCheck(
      tool({ inputSchema: '{"type":"object","properties":{"a"', inputSchemaIsObject: true })
    );
    expect(c?.status).toBe('pass');
  });

  it('a schema the probe could not judge is Skipped, not failed', () => {
    const c = schemaCheck(tool({ inputSchema: '{"type":"obj', inputSchemaTruncated: true }));
    expect(c?.status).toBe('skip');
  });

  it('a schema that is not an object still fails', () => {
    expect(schemaCheck(tool({ inputSchema: '[1,2]', inputSchemaIsObject: false }))?.status).toBe(
      'fail'
    );
    expect(schemaCheck(tool({ inputSchema: '[1,2]' }))?.status).toBe('fail');
  });

  it('is titled as what it checks: a JSON object, not a validated JSON Schema', () => {
    expect(schemaCheck(tool({ inputSchema: '{}' }))?.title).toContain('JSON object');
    expect(schemaCheck(tool({ inputSchema: '{}' }))?.title).not.toContain('JSON Schema');
  });
});

describe('F8 in the page-side probe: the schema is judged before it is cut', () => {
  const KEY = '__fafAgentDiscoveryWebMcp';
  afterEach(() => {
    (document as unknown as Record<string, unknown>).modelContext = undefined;
    (globalThis as Record<string, unknown>)[KEY] = undefined;
    vi.resetModules();
  });

  async function readFromPage(tools: unknown[]) {
    (document as unknown as Record<string, unknown>).modelContext = { getTools: async () => tools };
    vi.resetModules();
    await import('@/discovery/probe-webmcp');
    return (await (globalThis as Record<string, unknown>)[KEY]) as WebMcpTool[];
  }

  it('a 30,000-character object schema ships cut, marked as an object and as truncated', async () => {
    const big = { type: 'object', properties: { a: { description: 'x'.repeat(30_000) } } };
    const [t] = await readFromPage([{ name: 'big', description: 'd', inputSchema: big }]);
    expect(t.inputSchema?.length).toBe(20_000);
    expect(t.inputSchemaIsObject).toBe(true);
    expect(t.inputSchemaTruncated).toBe(true);
    expect(webMcpToolChecks(t).find((c) => c.id.endsWith('.input-schema'))?.status).toBe('pass');
  });

  it('a schema that is an array is judged not an object', async () => {
    const [t] = await readFromPage([{ name: 'arr', description: 'd', inputSchema: [1, 2] }]);
    expect(t.inputSchemaIsObject).toBe(false);
    expect(webMcpToolChecks(t).find((c) => c.id.endsWith('.input-schema'))?.status).toBe('fail');
  });
});

describe('F9: a page cannot flood or break the popup with its tool list', () => {
  const many = (n: number): WebMcpTool[] =>
    Array.from({ length: n }, (_, i) => ({ name: `t${i}`, description: 'd' }));

  it('caps the checked tools and says how many there were', async () => {
    const row = await probeWebMcp({
      origin: 'https://x.test',
      fetch,
      webmcp: async () => many(5000),
    });
    expect(row.status).toBe('found');
    expect(row.detail).toContain('5000');
    expect(row.detail).toContain(String(MAX_TOOLS));
    expect(row.checks?.length).toBeLessThanOrEqual(MAX_TOOLS * 4);
  });

  it('a tool list that is not an array is Unreadable', async () => {
    const row = await probeWebMcp({
      origin: 'https://x.test',
      fetch,
      webmcp: async () => ({ length: 3 }) as unknown as WebMcpTool[],
    });
    expect(row.status).toBe('unreadable');
  });

  it('hostile field types and lengths are tamed', async () => {
    const row = await probeWebMcp({
      origin: 'https://x.test',
      fetch,
      webmcp: async () =>
        [
          { name: 'x'.repeat(100_000), description: 'y'.repeat(1_000_000) },
          { name: { toString: () => 'obj' }, description: 7 },
          null,
        ] as unknown as WebMcpTool[],
    });
    expect(row.status).toBe('found');
    expect(JSON.stringify(row).length).toBeLessThan(20_000);
  });

  describe('in the popup', () => {
    afterEach(() => {
      document.body.innerHTML = '';
      vi.resetModules();
    });

    it('two tools with the same name, or several unnamed, still render', async () => {
      const dup: DiscoveryReport = {
        origin: 'https://x.test',
        pageUrl: 'https://x.test/',
        ms: 1,
        rows: [
          {
            id: 'webmcp',
            title: 'WebMCP tools',
            status: 'found',
            spec: { label: 'WebMCP', url: 'https://x.test/' },
            checks: [
              ...webMcpToolChecks({ name: 'same', description: 'a' }),
              ...webMcpToolChecks({ name: 'same', description: 'b' }),
              ...webMcpToolChecks({ name: '', description: 'c' }),
              ...webMcpToolChecks({ name: '', description: 'd' }),
            ],
          },
        ],
      };
      vi.doMock('@/discovery/run', () => ({
        chromeScripting: {},
        discoverTab: async () => ({ ok: true, report: dup }),
      }));
      // Fresh module graph for both, so Popup and the Svelte runtime are the same copy.
      const { flushSync, mount, unmount } = await import('svelte');
      const { default: Fresh } = await import('@/discovery/Popup.svelte');
      const target = document.createElement('div');
      document.body.append(target);
      const app = mount(Fresh, { target });
      flushSync();
      await vi.waitFor(() => expect(target.querySelectorAll('li.check').length).toBe(12), {
        timeout: 2000,
      });
      unmount(app);
    });
  });
});

describe('F14: a sandboxed page', () => {
  it('uses the origin from the URL when location.origin is "null"', () => {
    expect(pageOrigin({ href: 'https://a.test/x?y=1', origin: 'null' })).toBe('https://a.test');
  });

  it('keeps location.origin when it is real', () => {
    expect(pageOrigin({ href: 'https://a.test/x', origin: 'https://a.test' })).toBe(
      'https://a.test'
    );
  });
});

describe('F15 and F16: card URL scheme, and refused card fetches', () => {
  const catalogWith = (cardUrl: string) =>
    JSON.stringify({ entries: [{ type: SERVER_CARD_TYPE, url: cardUrl }] });

  it.each(['data:application/json,{}', 'javascript:alert(1)', 'blob:https://x.test/abc'])(
    'a card URL of %s is not checked',
    async (u) => {
      const checkSite = vi.fn(async () => []);
      const f = fetchFrom(() => respond(catalogWith(u), 'application/json'));
      const [, card] = await probeCatalog({ origin: 'https://x.test', fetch: f, checkSite });
      expect(checkSite).not.toHaveBeenCalled();
      expect(card.detail).toMatch(/http/i);
    }
  );

  it('with no request budget the card checks read Skipped, not failed', async () => {
    const f = fetchFrom(() => respond('{}', 'application/json'));
    const checks = await makeCheckSite(
      'https://x.test',
      f,
      8000,
      0
    )({ cardUrl: 'https://x.test/card', catalogUrl: 'https://x.test/.well-known/ai-catalog.json' });
    const cardChecks = checks.filter((c) => c.tier === 'card' || c.tier === 'hosting');
    expect(cardChecks.length).toBeGreaterThan(0);
    for (const c of cardChecks) {
      expect(c.status).toBe('skip');
      expect(c.detail).toMatch(/limit|outside/i);
    }
  });

  it('a card read fine stays checked even when a later request for the same URL hits the cap', async () => {
    const card = {
      $schema: 'https://static.modelcontextprotocol.io/schemas/v1/server-card.schema.json',
      name: 'com.example/x',
      version: '1.0.0',
      description: 'x',
      remotes: [{ type: 'streamable-http', url: 'https://x.test/mcp' }],
    };
    const f = fetchFrom((u) =>
      u.endsWith('/card')
        ? respond(JSON.stringify(card), SERVER_CARD_TYPE)
        : respond('{"entries":[]}', 'application/json')
    );
    // Room for the card's own checks, not for the catalog link check that asks for it again.
    const checks = await makeCheckSite(
      'https://x.test',
      f,
      8000,
      6
    )({ cardUrl: 'https://x.test/card', catalogUrl: 'https://x.test/.well-known/ai-catalog.json' });
    expect(checks.find((c) => c.id === 'card.schema-valid')?.status).toBe('pass');
  });
});
