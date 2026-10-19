/**
 * GitHub answers 429 when the repo page's own requests and ours land in a burst. The probe waits
 * and retries once; if GitHub is still limiting, the row says so instead of a bare "Unreadable".
 */

import { GITHUB_RETRY_MS, probeGithub } from '@/core/discovery';
import { describe, expect, it, vi } from 'vitest';

const PAGE = 'https://github.com/acme/widget';
const noWait = async (_ms: number) => undefined;

function scripted(statuses: Record<string, number[]>) {
  const calls: string[] = [];
  const f = (async (input: RequestInfo | URL) => {
    const url = String(input);
    calls.push(url);
    const name = url.split('/').pop() as string;
    const status = statuses[name].shift() ?? 200;
    return new Response(null, { status });
  }) as typeof fetch;
  return { f, calls };
}

describe('probeGithub and GitHub rate limits', () => {
  it('retries once after a 429 and reports the file found', async () => {
    const { f, calls } = scripted({ 'AGENTS.md': [429, 200], 'project.faf': [200] });
    const sleep = vi.fn(noWait);
    const rows = await probeGithub({ origin: 'https://github.com', fetch: f, sleep }, PAGE);
    expect(rows.map((r) => `${r.id}:${r.status}`)).toEqual([
      'agents-md:found',
      'project-faf:found',
    ]);
    expect(sleep).toHaveBeenCalledTimes(1);
    expect(sleep).toHaveBeenCalledWith(GITHUB_RETRY_MS[0]);
    expect(calls.filter((u) => u.endsWith('AGENTS.md'))).toHaveLength(2);
  });

  it('says GitHub is rate-limiting when the retry is limited too', async () => {
    const { f } = scripted({ 'AGENTS.md': [429, 429, 429], 'project.faf': [200] });
    const rows = await probeGithub({ origin: 'https://github.com', fetch: f, sleep: noWait }, PAGE);
    expect(rows[0]).toMatchObject({ id: 'agents-md', status: 'unreadable' });
    expect(rows[0].detail).toContain('HTTP 429');
    expect(rows[0].detail).toContain('Check again');
  });

  it('recovers on the second retry, after waiting 1.5 s then 3 s', async () => {
    const { f } = scripted({ 'AGENTS.md': [429, 429, 200], 'project.faf': [200] });
    const sleep = vi.fn(noWait);
    const rows = await probeGithub({ origin: 'https://github.com', fetch: f, sleep }, PAGE);
    expect(rows[0].status).toBe('found');
    expect(sleep.mock.calls.map((c) => c[0])).toEqual(GITHUB_RETRY_MS);
  });

  it('does not retry an ordinary 404 (the file just is not there)', async () => {
    const { f, calls } = scripted({ 'AGENTS.md': [404], 'project.faf': [404] });
    const sleep = vi.fn(noWait);
    const rows = await probeGithub({ origin: 'https://github.com', fetch: f, sleep }, PAGE);
    expect(rows.map((r) => r.status)).toEqual(['missing', 'missing']);
    expect(sleep).not.toHaveBeenCalled();
    expect(calls).toHaveLength(2);
  });
});
