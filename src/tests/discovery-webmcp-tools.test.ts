/**
 * Agent Discovery Check - WebMCP per-tool checks (step 3e). Each rule is the spec's own:
 * ModelContextTool (name, description, inputSchema) and registerTool(); annotations are
 * optional, so they are reported as a note, never as an issue.
 */

import { issues, probeWebMcp, webMcpToolChecks } from '@/core/discovery';
import type { WebMcpTool } from '@/core/discovery';
import { describe, expect, it } from 'vitest';

const good: WebMcpTool = {
  name: 'score_faf',
  description: 'Score a .faf document 0-100.',
  inputSchema: JSON.stringify({ type: 'object', properties: { yaml: { type: 'string' } } }),
  annotations: { readOnlyHint: true, untrustedContentHint: false },
};
const byKey = (checks: ReturnType<typeof webMcpToolChecks>, k: string) =>
  checks.find((c) => c.id.endsWith(`.${k}`));

describe('webMcpToolChecks', () => {
  it('passes a well-formed tool, three MUSTs and one note, each linked to the spec section', () => {
    const checks = webMcpToolChecks(good);
    expect(checks.map((c) => `${c.level}:${c.status}`)).toEqual([
      'must:pass',
      'must:pass',
      'must:pass',
      'note:info',
    ]);
    for (const c of checks)
      expect(c.spec?.url).toMatch(/^https:\/\/webmachinelearning\.github\.io\/webmcp\/#/);
    expect(byKey(checks, 'annotations')?.detail).toBe('readOnlyHint');
  });

  it('enforces the name rule: 1-128 of ASCII letters, digits, _ - .', () => {
    for (const ok of ['a', 'get-weather.v2', 'x'.repeat(128)])
      expect(byKey(webMcpToolChecks({ ...good, name: ok }), 'name')?.status).toBe('pass');
    for (const bad of ['', 'has space', 'émoji', 'x'.repeat(129), 'a/b'])
      expect(byKey(webMcpToolChecks({ ...good, name: bad }), 'name')?.status).toBe('fail');
  });

  it('fails a missing or blank description (registerTool rejects it)', () => {
    expect(
      byKey(webMcpToolChecks({ ...good, description: undefined }), 'description')?.status
    ).toBe('fail');
    expect(byKey(webMcpToolChecks({ ...good, description: '   ' }), 'description')?.status).toBe(
      'fail'
    );
  });

  it('checks the input schema only when there is one, and only that it is a JSON object', () => {
    expect(
      byKey(webMcpToolChecks({ ...good, inputSchema: undefined }), 'input-schema')
    ).toBeUndefined();
    expect(byKey(webMcpToolChecks({ ...good, inputSchema: '[1,2]' }), 'input-schema')?.status).toBe(
      'fail'
    );
    expect(
      byKey(webMcpToolChecks({ ...good, inputSchema: 'not json' }), 'input-schema')?.status
    ).toBe('fail');
  });

  it('says a declarative tool cannot declare annotations yet (#163), as a note, not an issue', () => {
    const checks = webMcpToolChecks({
      ...good,
      name: 'fill_6ws',
      annotations: null,
      declarative: true,
    });
    const note = byKey(checks, 'annotations');
    expect(note).toMatchObject({ level: 'note', status: 'info' });
    expect(note?.detail).toContain('webmcp#163');
  });

  it('reports an imperative tool with no hints as "none declared", not as a failure', () => {
    expect(byKey(webMcpToolChecks({ ...good, annotations: null }), 'annotations')?.detail).toBe(
      'none declared (all hints default to false)'
    );
  });
});

describe('probeWebMcp with checks', () => {
  it("attaches every tool's checks to the row; notes never count as issues", async () => {
    const row = await probeWebMcp({
      origin: 'https://example.com',
      fetch: fetch,
      webmcp: async () => [
        good,
        {
          name: 'fill_6ws',
          description: 'Capture the 6 Ws.',
          annotations: null,
          declarative: true,
        },
      ],
    });
    expect(row.status).toBe('found');
    expect(row.checks).toHaveLength(7); // 4 + 3 (no schema on the second)
    expect(issues(row)).toEqual({ must: 0, should: 0 });
  });

  it('counts a broken tool as a MUST issue on the row', async () => {
    const row = await probeWebMcp({
      origin: 'https://example.com',
      fetch: fetch,
      webmcp: async () => [{ name: 'bad name', description: '' }],
    });
    expect(issues(row)).toEqual({ must: 2, should: 0 });
  });
});
