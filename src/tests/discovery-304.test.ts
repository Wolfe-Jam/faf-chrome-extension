/**
 * N1 (second review): 304 Not Modified is not a redirect.
 *
 * The checker's ETag check sends If-None-Match; a well-served card answers 304. That was recorded
 * as a redirect, which turned every card and hosting check into Skipped ("the card URL redirects")
 * on exactly the cards that are configured best.
 */

import { type Server, createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { isRedirect } from '@/core/discovery';
import { makeCheckSite } from '@/discovery/check-site';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const fake = (type: string, status: number) => ({ type, status }) as unknown as Response;

describe('isRedirect', () => {
  it.each([301, 302, 303, 307, 308])('%s is a redirect', (status) =>
    expect(isRedirect(fake('basic', status))).toBe(true)
  );

  it('the opaque redirect a browser returns for redirect: "manual" is a redirect', () =>
    expect(isRedirect(fake('opaqueredirect', 0))).toBe(true));

  it.each([300, 304, 305, 200, 404, 429, 500])('%s is not a redirect', (status) =>
    expect(isRedirect(fake('basic', status))).toBe(false)
  );
});

describe('a card served with an ETag keeps its checks', () => {
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
          'content-type': 'application/mcp-server-card+json',
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

  it('answering 304 to a conditional GET does not Skip the card and hosting checks', async () => {
    const checks = await makeCheckSite(
      origin,
      fetch
    )({
      cardUrl: `${origin}/card`,
      catalogUrl: `${origin}/.well-known/ai-catalog.json`,
    });
    const card = checks.filter((c) => c.tier === 'card' || c.tier === 'hosting');
    expect(card.length).toBeGreaterThan(10);
    expect(card.filter((c) => /redirect/i.test(c.detail ?? ''))).toEqual([]);
    expect(card.find((c) => c.id === 'card.schema-valid')?.status).toBe('pass');
    expect(card.find((c) => c.id === 'hosting.etag')?.status).toBe('pass');
  });
});
