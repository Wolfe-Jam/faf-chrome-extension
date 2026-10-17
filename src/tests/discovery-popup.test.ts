/**
 * Agent Discovery Check - popup component (Svelte 5 under jsdom, runner mocked)
 */

import type { DiscoveryReport } from '@/core/discovery';
import Popup from '@/discovery/Popup.svelte';
import { discoverTab } from '@/discovery/run';
import { flushSync, mount, unmount } from 'svelte';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/discovery/run', () => ({
  chromeScripting: {},
  discoverTab: vi.fn(),
}));

const spec = (label: string) => ({
  label,
  url: `https://spec.example/${encodeURIComponent(label)}`,
});

const report: DiscoveryReport = {
  origin: 'https://example.com',
  pageUrl: 'https://example.com/',
  ms: 42,
  rows: [
    {
      id: 'ai-catalog',
      title: 'AI Catalog',
      status: 'found',
      detail: '3 entries',
      spec: spec('AI Catalog'),
    },
    {
      id: 'server-card',
      title: 'MCP Server Card',
      status: 'skipped',
      detail: 'needs an AI Catalog',
      spec: spec('MCP Server Card'),
    },
    { id: 'llms-txt', title: 'llms.txt', status: 'missing', spec: spec('llms.txt') },
    {
      id: 'webmcp',
      title: 'WebMCP tools',
      status: 'unreadable',
      detail: 'boom',
      spec: spec('WebMCP'),
    },
    {
      id: 'project-faf',
      title: 'project.faf',
      status: 'found',
      spec: spec('project.faf (IANA application/vnd.faf+yaml)'),
    },
  ],
};

const run = vi.mocked(discoverTab);
let app: ReturnType<typeof mount> | null = null;
let target: HTMLElement;

async function open() {
  target = document.createElement('div');
  document.body.append(target);
  app = mount(Popup, { target });
  flushSync();
}

const text = () => target.textContent ?? '';
const settle = (fn: () => void) => vi.waitFor(fn, { timeout: 2000 });

type ChromeMock = { tabs: { query: unknown }; scripting?: unknown };
const chromeMock = () => (globalThis as unknown as { chrome: ChromeMock }).chrome;
let savedQuery: unknown;

// Extend the shared chrome mock from setup.ts in place (its afterEach needs chrome.runtime) and restore it.
beforeEach(() => {
  run.mockReset();
  savedQuery = chromeMock().tabs.query;
  chromeMock().tabs.query = vi.fn().mockResolvedValue([{ id: 7, url: 'https://example.com/' }]);
});

afterEach(async () => {
  if (app) await unmount(app);
  app = null;
  target?.remove();
  chromeMock().tabs.query = savedQuery;
});

describe('popup states', () => {
  it('shows "Checking" first, then one row per surface with the host', async () => {
    run.mockResolvedValue({ ok: true, report });
    await open();
    expect(text()).toContain('Checking this site');
    await settle(() => expect(target.querySelectorAll('li')).toHaveLength(5));
    expect(text()).toContain('example.com');
    expect(text()).toContain('42 ms');
  });

  it('labels every status in words, not only by glyph', async () => {
    run.mockResolvedValue({ ok: true, report });
    await open();
    await settle(() => expect(target.querySelectorAll('li')).toHaveLength(5));
    const labels = [...target.querySelectorAll('.status')].map((e) => e.textContent);
    expect(labels).toEqual(['Published', 'Skipped', 'Not published', 'Unreadable', 'Published']);
    // The glyph is decoration; screen readers get the word.
    for (const m of target.querySelectorAll('.mark'))
      expect(m.getAttribute('aria-hidden')).toBe('true');
  });

  it('puts the status class on each row so the colour bar follows the verdict', async () => {
    run.mockResolvedValue({ ok: true, report });
    await open();
    await settle(() => expect(target.querySelectorAll('li')).toHaveLength(5));
    // Svelte appends a scoped-CSS hash class, so the status is the first class, not the whole string.
    expect([...target.querySelectorAll('li')].map((li) => li.classList[0])).toEqual([
      'found',
      'skipped',
      'missing',
      'unreadable',
      'found',
    ]);
  });

  it('spec links read "Spec ↗", keep the full name for hover and screen readers, and open safely', async () => {
    run.mockResolvedValue({ ok: true, report });
    await open();
    await settle(() => expect(target.querySelectorAll('li')).toHaveLength(5));
    const links = [...target.querySelectorAll<HTMLAnchorElement>('li a')];
    expect(links.map((a) => a.textContent)).toEqual(Array(5).fill('Spec ↗'));
    expect(links[4].title).toBe('project.faf (IANA application/vnd.faf+yaml)');
    expect(links[4].getAttribute('aria-label')).toBe(
      'project.faf (IANA application/vnd.faf+yaml) spec'
    );
    for (const a of links) {
      expect(a.target).toBe('_blank');
      expect(a.rel).toContain('noreferrer');
      expect(a.href).toMatch(/^https:\/\//);
    }
  });

  it('shows the approved byline', async () => {
    run.mockResolvedValue({ ok: true, report });
    await open();
    expect(text()).toContain('By James Wolfe, .FAF Creator and AAIF Ambassador');
  });

  it('a page that cannot be checked shows the reason as an alert, with a retry', async () => {
    run.mockResolvedValue({ ok: false, reason: 'This page cannot be checked.' });
    await open();
    await settle(() => expect(target.querySelector('[role="alert"]')).not.toBeNull());
    expect(target.querySelector('[role="alert"]')?.textContent).toContain('cannot be checked');
    expect(target.querySelector('button')?.textContent).toBe('Try again');
  });

  it('a runner that throws becomes an alert, not a blank popup', async () => {
    run.mockRejectedValue(new Error('Extension context invalidated'));
    await open();
    await settle(() =>
      expect(target.querySelector('[role="alert"]')?.textContent).toContain(
        'Extension context invalidated'
      )
    );
  });

  it('a failing tab query becomes an alert too', async () => {
    chromeMock().tabs.query = vi.fn().mockRejectedValue(new Error('No current window'));
    await open();
    await settle(() =>
      expect(target.querySelector('[role="alert"]')?.textContent).toContain('No current window')
    );
  });

  it('"Check again" runs the check again on the active tab', async () => {
    run.mockResolvedValue({ ok: true, report });
    await open();
    await settle(() => expect(target.querySelector('.actions button')).not.toBeNull());
    expect(run).toHaveBeenCalledTimes(1);
    expect(run.mock.calls[0][0]).toMatchObject({ id: 7, url: 'https://example.com/' });
    target.querySelector<HTMLButtonElement>('.actions button')?.click();
    await settle(() => expect(run).toHaveBeenCalledTimes(2));
  });
});
