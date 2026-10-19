/**
 * Agent Discovery Check - manifest and claims guards (source files, no build needed)
 *
 * The permission list is the product's promise ("reads a site only when you click"),
 * so it is pinned here: widening it must break a test, not slip through a review.
 */

import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = resolve(__dirname, '..', '..');
const read = (p: string) => readFileSync(join(ROOT, p), 'utf8');
const manifest = JSON.parse(read('public-discovery/manifest.json')) as Record<string, unknown>;

function files(dir: string, ext: RegExp): string[] {
  return readdirSync(join(ROOT, dir)).flatMap((name) => {
    const rel = `${dir}/${name}`;
    return statSync(join(ROOT, rel)).isDirectory() ? files(rel, ext) : ext.test(name) ? [rel] : [];
  });
}

describe('manifest: the permission promise', () => {
  it('is Manifest V3 with the approved name', () => {
    expect(manifest.manifest_version).toBe(3);
    expect(manifest.name).toBe('Agent Discovery Check');
  });

  it('asks for activeTab and scripting, and nothing else', () => {
    expect([...(manifest.permissions as string[])].sort()).toEqual(['activeTab', 'scripting']);
  });

  it.each([
    'host_permissions',
    'optional_permissions',
    'optional_host_permissions',
    'content_scripts',
    'background',
    'web_accessible_resources',
    'externally_connectable',
    'commands',
    'declarative_net_request',
  ])('declares no %s', (key) => {
    expect(manifest).not.toHaveProperty(key);
  });

  it('every file the manifest points at exists', () => {
    const action = manifest.action as {
      default_popup: string;
      default_icon: Record<string, string>;
    };
    expect(existsSync(join(ROOT, 'public-discovery', action.default_popup))).toBe(true);
    const icons = [
      ...Object.values(manifest.icons as Record<string, string>),
      ...Object.values(action.default_icon),
    ];
    for (const icon of icons) expect(existsSync(join(ROOT, 'public', icon)), icon).toBe(true);
  });
});

describe('build wiring: injected file names match what the build emits', () => {
  const config = read('vite.discovery.config.ts');
  const emitted = [...config.matchAll(/file: '([^']+\.js)'/g)].map((m) => m[1]).sort();

  it('the build emits popup.js, probe-site.js and probe-webmcp.js', () => {
    expect(emitted).toEqual(['popup.js', 'probe-site.js', 'probe-webmcp.js']);
  });

  it('run.ts injects only files the build emits', () => {
    const injected = [...read('src/discovery/run.ts').matchAll(/'(probe-[a-z-]+\.js)'/g)].map(
      (m) => m[1]
    );
    expect(injected.length).toBeGreaterThan(0);
    for (const f of injected) expect(emitted).toContain(f);
  });

  it('popup.html loads popup.js', () => {
    expect(read('public-discovery/popup.html')).toContain('src="popup.js"');
  });

  it('the build script runs every entry', () => {
    const script = (JSON.parse(read('package.json')) as { scripts: Record<string, string> })
      .scripts.build;
    for (const entry of ['popup', 'probe-site', 'probe-webmcp'])
      expect(script).toContain(`DISCOVERY_ENTRY=${entry}`);
  });
});

describe('claims: nothing the product cannot stand behind', () => {
  const shipped = [
    'public-discovery/manifest.json',
    'public-discovery/popup.html',
    ...files('src/discovery', /\.(ts|svelte)$/),
    'src/core/discovery.ts',
  ];

  it('never uses "guarantee" in any form (free software, no guarantees)', () => {
    for (const f of shipped) expect(read(f), f).not.toMatch(/guarant/i);
  });

  it('never claims zero network or 100% local: it fetches files from the site you click', () => {
    for (const f of shipped)
      expect(read(f), f).not.toMatch(/zero network|no network|100% (local|private)/i);
  });

  it('never reaches for a third-party host: probes read only the page origin', () => {
    const hosts = shipped
      .filter((f) => f.endsWith('.ts'))
      .flatMap((f) => [
        ...read(f).matchAll(
          /https?:\/\/(?!ai-catalog\.io|github\.com|llmstxt\.org|agents\.md|webmachinelearning\.github\.io|www\.iana\.org)[a-z0-9.-]+/gi
        ),
      ])
      .map((m) => m[0]);
    expect(hosts).toEqual([]);
  });
});
