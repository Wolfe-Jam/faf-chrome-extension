/**
 * Agent Discovery Check - spec checks (step 3d): the core wiring with a fake checker, and the
 * real mcp-server-card-check run in the page's shoes (fake fetch, no network).
 */

import { AI_CATALOG_PATH, SERVER_CARD_TYPE, issues, probeCatalog } from '@/core/discovery';
import type { ProbeContext, SpecCheck } from '@/core/discovery';
import { makeCheckSite, readOnlyFetch } from '@/discovery/check-site';
import { describe, expect, it } from 'vitest';

const ORIGIN = 'https://example.com';
const CATALOG = ORIGIN + AI_CATALOG_PATH;
const CARD = `${ORIGIN}/mcp/server-card`;
const SCHEMA = 'https://static.modelcontextprotocol.io/schemas/v1/server-card.schema.json';

const card = {
  $schema: SCHEMA,
  name: 'com.example/weather',
  version: '2.0.0',
  description: 'Weather for agents.',
  remotes: [
    { type: 'streamable-http', url: `${ORIGIN}/mcp`, supportedProtocolVersions: ['2025-11-25'] },
  ],
};

type Handler = (url: string, init?: RequestInit) => Response | Promise<Response>;
const fetchFrom = (h: Handler): typeof fetch =>
  ((i: RequestInfo | URL, init?: RequestInit) =>
    Promise.resolve(h(String(i), init))) as typeof fetch;

const catalogFor = (cardUrl: string) =>
  JSON.stringify({
    specVersion: '1.0',
    host: { displayName: 'Example', identifier: ORIGIN },
    entries: [
      { identifier: 'urn:air:example.com:mcp:weather', type: SERVER_CARD_TYPE, url: cardUrl },
    ],
  });

describe('probeCatalog with spec checks (fake checker)', () => {
  const fake = (checks: SpecCheck[]) => async () => checks;
  const ctx = (checkSite?: ProbeContext['checkSite'], entries = 1): ProbeContext => ({
    origin: ORIGIN,
    fetch: fetchFrom((u) =>
      u === CATALOG
        ? new Response(
            JSON.stringify({
              entries: Array.from({ length: entries }, () => ({
                type: SERVER_CARD_TYPE,
                url: '/mcp/server-card',
              })),
            }),
            { status: 200, headers: { 'content-type': 'application/json' } }
          )
        : new Response('nope', { status: 404 })
    ),
    ...(checkSite ? { checkSite } : {}),
  });

  it('puts catalog checks under the catalog row and card + hosting checks under the card row', async () => {
    const checks: SpecCheck[] = [
      { id: 'catalog.host', tier: 'catalog', level: 'must', title: 'host', status: 'pass' },
      { id: 'card.schema-valid', tier: 'card', level: 'must', title: 'schema', status: 'fail' },
      { id: 'hosting.etag', tier: 'hosting', level: 'should', title: 'etag', status: 'fail' },
    ];
    const [catalog, cardRow] = await probeCatalog(ctx(fake(checks)));
    expect(catalog.checks?.map((c) => c.id)).toEqual(['catalog.host']);
    expect(cardRow.checks?.map((c) => c.id)).toEqual(['card.schema-valid', 'hosting.etag']);
    expect(cardRow.url).toBe(CARD);
    expect(issues(cardRow)).toEqual({ must: 1, should: 1 });
    expect(issues(catalog)).toEqual({ must: 0, should: 0 });
  });

  it('says which card was checked when the catalog lists several', async () => {
    const [, cardRow] = await probeCatalog(ctx(fake([]), 3));
    expect(cardRow.detail).toBe('3 listed in the catalog; the first is checked');
  });

  it('keeps the row when the checker throws, and says so', async () => {
    const [, cardRow] = await probeCatalog(
      ctx(async () => {
        throw new Error('boom');
      })
    );
    expect(cardRow.status).toBe('found');
    expect(cardRow.detail).toContain('checks could not run (boom)');
    expect(cardRow.checks).toBeUndefined();
  });

  it('runs no checks without a checker (unit tests, older builds)', async () => {
    const [catalog, cardRow] = await probeCatalog(ctx());
    expect(catalog.checks).toBeUndefined();
    expect(cardRow.checks).toBeUndefined();
  });
});

describe('makeCheckSite (real mcp-server-card-check, fake network)', () => {
  const served =
    (cardUrl: string, headers: Record<string, string> = {}): Handler =>
    (u) => {
      if (u === CATALOG)
        return new Response(catalogFor(cardUrl), {
          status: 200,
          headers: { 'content-type': 'application/ai-catalog+json' },
        });
      if (u === cardUrl)
        return new Response(JSON.stringify(card), {
          status: 200,
          headers: { 'content-type': SERVER_CARD_TYPE, ...headers },
        });
      return new Response('nope', { status: 404 });
    };

  it('returns only card, hosting and catalog checks, each with a spec link', async () => {
    const checks = await makeCheckSite(
      ORIGIN,
      fetchFrom(served(CARD))
    )({ cardUrl: CARD, catalogUrl: CATALOG });
    expect(checks.length).toBeGreaterThan(10);
    expect(new Set(checks.map((c) => c.tier))).toEqual(new Set(['card', 'hosting', 'catalog']));
    expect(checks.find((c) => c.id === 'card.schema-valid')?.status).toBe('pass');
    for (const c of checks) expect(c.spec?.url).toMatch(/^https:\/\//);
  });

  it('reads a same-origin card with its headers (a missing CORS header fails)', async () => {
    const checks = await makeCheckSite(
      ORIGIN,
      fetchFrom(served(CARD))
    )({ cardUrl: CARD, catalogUrl: CATALOG });
    expect(checks.find((c) => c.id === 'hosting.cors-origin')?.status).toBe('fail');
  });

  it('skips header checks on a card from another origin, pointing at the web checker', async () => {
    const other = 'https://cards.example.net/mcp/server-card';
    const checks = await makeCheckSite(
      ORIGIN,
      fetchFrom(served(other))
    )({ cardUrl: other, catalogUrl: CATALOG });
    const cors = checks.filter((c) => /^hosting\.(cors-|etag)/.test(c.id));
    expect(cors.length).toBeGreaterThan(0);
    for (const c of cors) {
      expect(c.status).toBe('skip');
      expect(c.detail).toContain('servercard.wolfejam.dev');
    }
    expect(checks.find((c) => c.id === 'card.schema-valid')?.status).toBe('pass');
  });

  it('never sends a POST', async () => {
    const methods: string[] = [];
    const spy: Handler = (u, init) => {
      methods.push((init?.method ?? 'GET').toUpperCase());
      return served(CARD)(u, init);
    };
    await makeCheckSite(ORIGIN, fetchFrom(spy))({ cardUrl: CARD, catalogUrl: CATALOG });
    expect(methods).not.toContain('POST');
    await expect(readOnlyFetch(fetchFrom(spy))(CARD, { method: 'POST' })).rejects.toThrow(
      'read-only'
    );
  });
});
