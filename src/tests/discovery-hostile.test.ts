/**
 * Agent Discovery Check - hostile servers (real local HTTP, no fakes for the network).
 *
 * Mirrors the cases in mcp-server-card-check's width suite that apply to site probes:
 * huge and endless bodies, a server that never answers, a BOM, deep nesting, __proto__ keys,
 * redirects, and a wrong Content-Type. The verdicts must hold and the run must finish.
 */

import { type IncomingMessage, type Server, type ServerResponse, createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import {
  AI_CATALOG_PATH,
  LLMS_TXT_PATH,
  SERVER_CARD_TYPE,
  probeCatalog,
  probeLlmsTxt,
} from '@/core/discovery';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

type Handler = (req: IncomingMessage, res: ServerResponse) => void;

let server: Server;
let origin: string;
let handler: Handler = (_req, res) => {
  res.statusCode = 404;
  res.end('not found');
};
/** Bytes the server managed to push before the client hung up. */
let pushed = 0;

beforeAll(async () => {
  server = createServer((req, res) => handler(req, res));
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
  origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

afterAll(async () => {
  server.closeAllConnections();
  await new Promise<void>((r) => server.close(() => r()));
});

const ctx = (timeoutMs?: number) => ({ origin, fetch, timeoutMs });
const serve = (h: Handler) => {
  pushed = 0;
  handler = h;
};

/** Streams `chunk` until the client disconnects (or `limit` bytes if given). */
function stream(
  chunk: string,
  headers: Record<string, string>,
  limit = Number.POSITIVE_INFINITY
): Handler {
  return (_req, res) => {
    res.writeHead(200, headers);
    const timer = setInterval(() => {
      if (res.destroyed || res.writableEnded) return clearInterval(timer);
      if (pushed >= limit) {
        clearInterval(timer);
        return res.end();
      }
      pushed += chunk.length;
      res.write(chunk);
    }, 0);
    res.on('close', () => clearInterval(timer));
  };
}

const KIB = 1024;
const MIB = 1024 * KIB;
const CATALOG = JSON.stringify({ entries: [{ type: SERVER_CARD_TYPE }] });

describe('big and endless bodies', () => {
  it(
    'a 12 MiB llms.txt is read only up to the cap, not buffered whole',
    { timeout: 20_000 },
    async () => {
      serve(stream('a'.repeat(64 * KIB), { 'content-type': 'text/plain' }, 12 * MIB));
      const r = await probeLlmsTxt(ctx());
      expect(r).toMatchObject({ status: 'found', detail: 'over 1 MiB' });
      expect(pushed).toBeLessThan(4 * MIB); // stopped near 1 MiB, did not drain all 12
    }
  );

  it(
    'an endless llms.txt body is cut at the cap instead of hanging',
    { timeout: 20_000 },
    async () => {
      serve(stream('a'.repeat(64 * KIB), { 'content-type': 'text/plain' }));
      const t0 = Date.now();
      const r = await probeLlmsTxt(ctx(15_000));
      expect(r).toMatchObject({ status: 'found', detail: 'over 1 MiB' });
      expect(Date.now() - t0).toBeLessThan(5_000);
    }
  );

  it('a catalog larger than the cap is unreadable and says why', { timeout: 20_000 }, async () => {
    serve(
      stream(' '.repeat(64 * KIB), { 'content-type': 'application/ai-catalog+json' }, 12 * MIB)
    );
    const [catalog, card] = await probeCatalog(ctx());
    expect(catalog).toMatchObject({ status: 'unreadable', detail: 'larger than 1 MiB' });
    expect(card.status).toBe('skipped');
  });
});

describe('a server that never answers', () => {
  it('is timed out and reported as unreadable, quickly', { timeout: 10_000 }, async () => {
    serve(() => {
      /* accept the request, never respond */
    });
    const t0 = Date.now();
    const [catalog] = await probeCatalog(ctx(300));
    expect(catalog.status).toBe('unreadable');
    expect(Date.now() - t0).toBeLessThan(3_000);
  });

  it('headers sent, body stalls forever: still times out', { timeout: 10_000 }, async () => {
    serve((_req, res) => {
      res.writeHead(200, { 'content-type': 'text/plain' });
      res.write('# half a file');
    });
    const t0 = Date.now();
    const r = await probeLlmsTxt(ctx(300));
    expect(r.status).toBe('unreadable');
    expect(Date.now() - t0).toBeLessThan(3_000);
  });
});

describe('messy but legal JSON', () => {
  it('a UTF-8 BOM before the catalog is tolerated', async () => {
    serve((_req, res) => {
      res.writeHead(200, { 'content-type': 'application/ai-catalog+json' });
      res.end(Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), Buffer.from(CATALOG)]));
    });
    const [catalog, card] = await probeCatalog(ctx());
    expect(catalog.status).toBe('found');
    expect(card.status).toBe('found');
  });

  it(
    'a catalog nested 100,000 levels deep gets a row, not a crash',
    { timeout: 20_000 },
    async () => {
      serve((_req, res) => {
        res.writeHead(200, { 'content-type': 'application/ai-catalog+json' });
        res.end(`{"entries":${'['.repeat(100_000)}${']'.repeat(100_000)}}`);
      });
      const rows = await probeCatalog(ctx());
      expect(rows[0].id).toBe('ai-catalog');
      expect(['found', 'unreadable']).toContain(rows[0].status);
    }
  );

  it("__proto__ keys in a catalog don't pollute Object.prototype", async () => {
    serve((_req, res) => {
      res.writeHead(200, { 'content-type': 'application/ai-catalog+json' });
      res.end(
        '{"entries":[{"type":"x","__proto__":{"polluted":true}}],"__proto__":{"polluted":true}}'
      );
    });
    await probeCatalog(ctx());
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
  });

  it('entries holding nulls, numbers and strings are counted but never crash the card filter', async () => {
    serve((_req, res) => {
      res.writeHead(200, { 'content-type': 'application/ai-catalog+json' });
      res.end(JSON.stringify({ entries: [null, 7, 'x', [], { type: SERVER_CARD_TYPE }] }));
    });
    const [catalog, card] = await probeCatalog(ctx());
    expect(catalog).toMatchObject({ status: 'found', detail: '5 entries' });
    expect(card).toMatchObject({ status: 'found', detail: '1 listed in the catalog' });
  });
});

describe('redirects and headers', () => {
  it('a catalog behind a same-origin redirect is followed', async () => {
    serve((req, res) => {
      if (req.url === AI_CATALOG_PATH) {
        res.writeHead(302, { location: '/moved/catalog.json' });
        res.end();
      } else {
        res.writeHead(200, { 'content-type': 'application/ai-catalog+json' });
        res.end(CATALOG);
      }
    });
    const [catalog] = await probeCatalog(ctx());
    expect(catalog.status).toBe('found');
  });

  it('a redirect loop is unreadable, not an endless wait', { timeout: 10_000 }, async () => {
    serve((_req, res) => {
      res.writeHead(302, { location: AI_CATALOG_PATH });
      res.end();
    });
    const [catalog] = await probeCatalog(ctx());
    expect(catalog.status).toBe('unreadable');
  });

  it('a valid catalog with the wrong Content-Type is still found (presence, not a media-type audit)', async () => {
    serve((_req, res) => {
      res.writeHead(200, { 'content-type': 'text/html' });
      res.end(CATALOG);
    });
    const [catalog, card] = await probeCatalog(ctx());
    expect(catalog.status).toBe('found');
    expect(card.status).toBe('found');
  });

  it('a genuine llms.txt served as text/html is found; only an HTML page is a soft 404', async () => {
    serve((_req, res) => {
      res.writeHead(200, { 'content-type': 'text/html' });
      res.end('# My site\n\n> What agents should know.\n');
    });
    expect((await probeLlmsTxt(ctx())).status).toBe('found');

    serve((_req, res) => {
      res.writeHead(200, { 'content-type': 'text/plain' });
      res.end('<!DOCTYPE html><html><body>Page not found</body></html>');
    });
    expect((await probeLlmsTxt(ctx())).status).toBe('missing');
  });

  it('paths other than the two probed are never requested', async () => {
    const seen: string[] = [];
    serve((req, res) => {
      seen.push(req.url ?? '');
      res.statusCode = 404;
      res.end();
    });
    await probeCatalog(ctx());
    await probeLlmsTxt(ctx());
    expect(seen.sort()).toEqual([AI_CATALOG_PATH, LLMS_TXT_PATH].sort());
  });
});
