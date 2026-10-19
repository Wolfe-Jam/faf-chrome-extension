/**
 * Agent Discovery Check - site probe tests (fake fetch, no network)
 */

import {
  AI_CATALOG_PATH,
  LLMS_TXT_PATH,
  SERVER_CARD_TYPE,
  parseGithubRepo,
  probeCatalog,
  probeGithub,
  probeLlmsTxt,
  probeWebMcp,
  runChecks,
} from '@/core/discovery';
import type { ProbeContext } from '@/core/discovery';
import { describe, expect, it } from 'vitest';

const ORIGIN = 'https://example.com';

type Reply = { status?: number; type?: string; body?: string } | Error;

/** A fetch that answers from a url -> reply table. Unlisted urls are 404. */
function fakeFetch(table: Record<string, Reply>): typeof fetch {
  return (async (input: RequestInfo | URL) => {
    const reply = table[String(input)];
    if (reply instanceof Error) throw reply;
    const { status = 404, type = 'text/plain', body = '' } = reply ?? {};
    return new Response(status === 404 ? 'nope' : body, {
      status,
      headers: { 'content-type': type },
    });
  }) as typeof fetch;
}

const ctx = (table: Record<string, Reply>, extra: Partial<ProbeContext> = {}): ProbeContext => ({
  origin: ORIGIN,
  fetch: fakeFetch(table),
  ...extra,
});

const catalogBody = (entries: unknown) => JSON.stringify({ entries });

describe('probeCatalog', () => {
  it('finds the catalog and a listed Server Card', async () => {
    const [catalog, card] = await probeCatalog(
      ctx({
        [ORIGIN + AI_CATALOG_PATH]: {
          status: 200,
          type: 'application/json',
          body: catalogBody([{ type: SERVER_CARD_TYPE }, { type: 'application/a2a-card+json' }]),
        },
      })
    );
    expect(catalog).toMatchObject({ id: 'ai-catalog', status: 'found', detail: '2 entries' });
    expect(card).toMatchObject({
      id: 'server-card',
      status: 'found',
      detail: '1 listed in the catalog',
    });
  });

  it('reports a catalog without a Server Card as missing, not failed', async () => {
    const [catalog, card] = await probeCatalog(
      ctx({
        [ORIGIN + AI_CATALOG_PATH]: {
          status: 200,
          body: catalogBody([{ type: 'application/a2a-card+json' }]),
        },
      })
    );
    expect(catalog.status).toBe('found');
    expect(card.status).toBe('missing');
  });

  it('404 is missing and skips the Server Card row', async () => {
    const [catalog, card] = await probeCatalog(ctx({}));
    expect(catalog.status).toBe('missing');
    expect(card.status).toBe('skipped');
  });

  it('200 that is not JSON is unreadable, not found', async () => {
    const [catalog] = await probeCatalog(
      ctx({
        [ORIGIN + AI_CATALOG_PATH]: { status: 200, type: 'text/plain', body: 'oops, not json' },
      })
    );
    expect(catalog).toMatchObject({ status: 'unreadable', detail: 'answered 200 but not JSON' });
  });

  it('JSON without an entries array is unreadable', async () => {
    const [catalog] = await probeCatalog(
      ctx({ [ORIGIN + AI_CATALOG_PATH]: { status: 200, body: '{"hello":1}' } })
    );
    expect(catalog).toMatchObject({ status: 'unreadable', detail: 'JSON has no entries array' });
  });

  it('a network error is unreadable with the reason', async () => {
    const [catalog] = await probeCatalog(
      ctx({ [ORIGIN + AI_CATALOG_PATH]: new Error('Failed to fetch') })
    );
    expect(catalog).toMatchObject({ status: 'unreadable', detail: 'Failed to fetch' });
  });

  it('a 500 is unreadable, not missing', async () => {
    const [catalog] = await probeCatalog(ctx({ [ORIGIN + AI_CATALOG_PATH]: { status: 500 } }));
    expect(catalog).toMatchObject({ status: 'unreadable', detail: 'HTTP 500' });
  });
});

describe('probeLlmsTxt', () => {
  it('finds a plain-text llms.txt', async () => {
    const r = await probeLlmsTxt(
      ctx({ [ORIGIN + LLMS_TXT_PATH]: { status: 200, body: '# Site\n> summary' } })
    );
    expect(r).toMatchObject({ id: 'llms-txt', status: 'found' });
  });

  it('reports bytes, not characters, for non-ASCII text', async () => {
    const body = '# Café — ✓'; // 10 characters, 15 bytes in UTF-8
    const r = await probeLlmsTxt(ctx({ [ORIGIN + LLMS_TXT_PATH]: { status: 200, body } }));
    expect(body.length).toBe(10);
    expect(r.detail).toBe('15 bytes');
  });

  it('says "over 1 MiB" when the read was capped, not a made-up size', async () => {
    const body = 'a'.repeat(1_048_576 + 50);
    const r = await probeLlmsTxt(ctx({ [ORIGIN + LLMS_TXT_PATH]: { status: 200, body } }));
    expect(r.detail).toBe('over 1 MiB');
  });

  it('a soft 404 (200 + HTML page) is missing', async () => {
    const r = await probeLlmsTxt(
      ctx({
        [ORIGIN + LLMS_TXT_PATH]: {
          status: 200,
          type: 'text/html; charset=utf-8',
          body: '<!doctype html><title>Not found</title>',
        },
      })
    );
    expect(r.status).toBe('missing');
  });

  it('an empty 200 is missing', async () => {
    const r = await probeLlmsTxt(ctx({ [ORIGIN + LLMS_TXT_PATH]: { status: 200, body: '   ' } }));
    expect(r.status).toBe('missing');
  });
});

describe('probeWebMcp', () => {
  it('lists the tools the page registers', async () => {
    const r = await probeWebMcp(
      ctx({}, { webmcp: async () => [{ name: 'emit_agents_md' }, { name: 'score_faf' }] })
    );
    expect(r).toMatchObject({ status: 'found', detail: '2 tools: emit_agents_md, score_faf' });
  });

  it('null means the page has no WebMCP API', async () => {
    const r = await probeWebMcp(ctx({}, { webmcp: async () => null }));
    expect(r).toMatchObject({ status: 'missing', detail: 'page exposes no WebMCP API' });
  });

  it('an API with zero tools is missing', async () => {
    const r = await probeWebMcp(ctx({}, { webmcp: async () => [] }));
    expect(r.detail).toBe('WebMCP API present, no tools registered');
  });

  it('a throwing reader is unreadable', async () => {
    const r = await probeWebMcp(
      ctx(
        {},
        {
          webmcp: async () => {
            throw new Error('boom');
          },
        }
      )
    );
    expect(r).toMatchObject({ status: 'unreadable', detail: 'boom' });
  });

  it('no reader means skipped, never a false missing', async () => {
    expect((await probeWebMcp(ctx({}))).status).toBe('skipped');
  });
});

describe('parseGithubRepo', () => {
  it.each([
    ['https://github.com/Wolfe-Jam/faf-cli', { owner: 'Wolfe-Jam', repo: 'faf-cli' }],
    ['https://github.com/Wolfe-Jam/faf-cli/pull/174', { owner: 'Wolfe-Jam', repo: 'faf-cli' }],
    ['https://github.com/Wolfe-Jam/faf-cli.git', { owner: 'Wolfe-Jam', repo: 'faf-cli' }],
  ])('reads %s', (url, expected) => expect(parseGithubRepo(url)).toEqual(expected));

  it.each([
    'https://github.com/',
    'https://github.com/Wolfe-Jam',
    'https://github.com/settings/profile',
    'https://github.com/orgs/aaif/people',
    'https://gitlab.com/a/b',
    'not a url',
  ])('is not a repo page: %s', (url) => expect(parseGithubRepo(url)).toBeNull());
});

describe('probeGithub', () => {
  const gh = 'https://github.com';
  const base = `${gh}/Wolfe-Jam/faf-cli/blob/HEAD/`;

  it('reports presence of AGENTS.md and project.faf separately', async () => {
    const rows = await probeGithub(
      { origin: gh, fetch: fakeFetch({ [`${base}AGENTS.md`]: { status: 200 } }) },
      `${gh}/Wolfe-Jam/faf-cli`
    );
    expect(rows.map((r) => [r.id, r.status])).toEqual([
      ['agents-md', 'found'],
      ['project-faf', 'missing'],
    ]);
  });

  it('adds no rows off GitHub or off a repo page', async () => {
    expect(await probeGithub(ctx({}), 'https://example.com/a/b')).toEqual([]);
    expect(
      await probeGithub({ origin: gh, fetch: fakeFetch({}) }, `${gh}/settings/profile`)
    ).toEqual([]);
  });
});

describe('runChecks', () => {
  it('returns every site surface in a stable order, each with a spec reference', async () => {
    const report = await runChecks(
      ctx(
        {
          [ORIGIN + AI_CATALOG_PATH]: {
            status: 200,
            body: catalogBody([{ type: SERVER_CARD_TYPE }]),
          },
          [ORIGIN + LLMS_TXT_PATH]: { status: 200, body: '# Example' },
        },
        { webmcp: async () => null }
      ),
      `${ORIGIN}/`
    );
    expect(report.rows.map((r) => `${r.id}:${r.status}`)).toEqual([
      'ai-catalog:found',
      'server-card:found',
      'llms-txt:found',
      'webmcp:missing',
    ]);
    for (const r of report.rows) expect(r.spec.url).toMatch(/^https:\/\//);
  });

  it('one slow or failing probe never hides the others', async () => {
    const report = await runChecks(
      ctx({
        [ORIGIN + AI_CATALOG_PATH]: new Error('Failed to fetch'),
        [ORIGIN + LLMS_TXT_PATH]: { status: 200, body: '# Ok' },
      }),
      `${ORIGIN}/`
    );
    expect(report.rows.find((r) => r.id === 'ai-catalog')?.status).toBe('unreadable');
    expect(report.rows.find((r) => r.id === 'llms-txt')?.status).toBe('found');
  });
});
