/**
 * Agent Discovery Check - tab runner tests (fake chrome.scripting, no browser)
 */

import type { DiscoveryReport } from '@/core/discovery';
import { type ScriptingApi, discoverTab, isCheckable } from '@/discovery/run';
import { describe, expect, it } from 'vitest';

const siteReport: DiscoveryReport = {
  origin: 'https://example.com',
  pageUrl: 'https://example.com/',
  ms: 12,
  rows: [
    {
      id: 'ai-catalog',
      title: 'AI Catalog',
      status: 'found',
      spec: { label: 'AI Catalog', url: 'https://ai-catalog.io/' },
    },
    {
      id: 'webmcp',
      title: 'WebMCP tools',
      status: 'skipped',
      spec: { label: 'WebMCP', url: 'https://x.test/' },
    },
    {
      id: 'llms-txt',
      title: 'llms.txt',
      status: 'missing',
      spec: { label: 'llms.txt', url: 'https://llmstxt.org/' },
    },
  ],
};

interface Call {
  world?: string;
  files?: string[];
  args?: string[];
}

/** Answers file injections with nothing and func reads by the key passed in args. */
function fakeScripting(values: Record<string, unknown>, fail: Record<string, Error> = {}) {
  const calls: Call[] = [];
  const api: ScriptingApi = {
    executeScript: async (inj) => {
      calls.push({ world: inj.world, files: inj.files, args: inj.args });
      const file = inj.files?.[0];
      if (file && fail[file]) throw fail[file];
      if (file) return [{}];
      return [{ result: values[inj.args?.[0] ?? ''] }];
    },
  };
  return { api, calls };
}

const KEYS = { site: '__fafAgentDiscoverySite', webmcp: '__fafAgentDiscoveryWebMcp' };

describe('isCheckable', () => {
  it.each(['https://example.com', 'http://localhost:3000/x'])('accepts %s', (u) =>
    expect(isCheckable(u)).toBe(true)
  );
  it.each([
    undefined,
    '',
    'chrome://extensions',
    'file:///tmp/a.html',
    'about:blank',
    'chrome-extension://abc/p.html',
  ])('rejects %s', (u) => expect(isCheckable(u)).toBe(false));
});

describe('discoverTab', () => {
  it('refuses pages it cannot read, without injecting anything', async () => {
    const { api, calls } = fakeScripting({});
    const out = await discoverTab({ id: 1, url: 'chrome://extensions' }, api);
    expect(out.ok).toBe(false);
    expect(calls).toHaveLength(0);
  });

  it('explains that Chrome blocks extensions on the Chrome Web Store', async () => {
    const { api, calls } = fakeScripting({});
    const out = await discoverTab(
      { id: 1, url: 'https://chromewebstore.google.com/detail/x/abc' },
      api
    );
    expect(out.ok).toBe(false);
    expect(calls).toHaveLength(0);
    if (!out.ok)
      expect(out.reason).toContain("Chrome doesn't let extensions check the Chrome Web Store");
  });

  it('refuses a tab with no id', async () => {
    const { api } = fakeScripting({});
    expect((await discoverTab({ url: 'https://example.com' }, api)).ok).toBe(false);
  });

  it('injects the site probe in ISOLATED and the WebMCP probe in MAIN', async () => {
    const { api, calls } = fakeScripting({
      [KEYS.site]: siteReport,
      [KEYS.webmcp]: [{ name: 'emit_agents_md' }],
    });
    await discoverTab({ id: 7, url: 'https://example.com/' }, api);
    expect(calls.filter((c) => c.files).map((c) => [c.files?.[0], c.world])).toEqual([
      ['probe-site.js', 'ISOLATED'],
      ['probe-webmcp.js', 'MAIN'],
    ]);
  });

  it('reads results back through args, never a closed-over variable', async () => {
    const { api, calls } = fakeScripting({ [KEYS.site]: siteReport, [KEYS.webmcp]: null });
    await discoverTab({ id: 7, url: 'https://example.com/' }, api);
    expect(calls.filter((c) => !c.files).map((c) => c.args)).toEqual([[KEYS.site], [KEYS.webmcp]]);
  });

  it('replaces the skipped WebMCP row with the real tools, keeping row order', async () => {
    const { api } = fakeScripting({
      [KEYS.site]: siteReport,
      [KEYS.webmcp]: [{ name: 'a' }, { name: 'b' }],
    });
    const out = await discoverTab({ id: 7, url: 'https://example.com/' }, api);
    if (!out.ok) throw new Error('expected ok');
    expect(out.report.rows.map((r) => r.id)).toEqual(['ai-catalog', 'webmcp', 'llms-txt']);
    expect(out.report.rows[1]).toMatchObject({ status: 'found', detail: '2 tools: a, b' });
  });

  it('a page with no WebMCP API reports missing, not skipped', async () => {
    const { api } = fakeScripting({ [KEYS.site]: siteReport, [KEYS.webmcp]: null });
    const out = await discoverTab({ id: 7, url: 'https://example.com/' }, api);
    if (!out.ok) throw new Error('expected ok');
    expect(out.report.rows[1]).toMatchObject({ id: 'webmcp', status: 'missing' });
  });

  it('a WebMCP injection failure only affects that row', async () => {
    const { api } = fakeScripting(
      { [KEYS.site]: siteReport },
      { 'probe-webmcp.js': new Error('Cannot access contents of the page') }
    );
    const out = await discoverTab({ id: 7, url: 'https://example.com/' }, api);
    if (!out.ok) throw new Error('expected ok');
    expect(out.report.rows[0].status).toBe('found');
    expect(out.report.rows[1]).toMatchObject({
      status: 'unreadable',
      detail: 'Cannot access contents of the page',
    });
  });

  it('a site injection failure is a clear error, not a crash', async () => {
    const { api } = fakeScripting(
      {},
      { 'probe-site.js': new Error('Cannot access contents of the page') }
    );
    const out = await discoverTab({ id: 7, url: 'https://example.com/' }, api);
    expect(out).toMatchObject({ ok: false });
    expect(out.ok === false && out.reason).toContain('Cannot access contents of the page');
  });

  it('an empty result from the page is an error, not a blank report', async () => {
    const { api } = fakeScripting({ [KEYS.site]: undefined });
    expect((await discoverTab({ id: 7, url: 'https://example.com/' }, api)).ok).toBe(false);
  });
});
