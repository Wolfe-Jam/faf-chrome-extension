#!/usr/bin/env node
/**
 * Agent Discovery Check - extension smoke test (local, real Chromium, the BUILT bundles).
 *
 *   node scripts/smoke-discovery.mjs
 *
 * What it proves that unit tests cannot:
 *   1. dist-discovery/probe-site.js and probe-webmcp.js work as shipped (minified IIFE) in a real
 *      browser, against real HTTP, on a full site, an empty site and a hostile site.
 *   2. The popup boots as a real extension page: no CSP error, no console error, renders.
 *
 * What it cannot do: click the toolbar button (activeTab needs a human click). That path is
 * covered by hand with `adc-test-browser dist-discovery`.
 *
 * Playwright is not a repo dependency; it is resolved from the adc-test-browser install.
 */

import { execSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdtempSync, realpathSync, rmSync } from 'node:fs';
import { createServer } from 'node:http';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const DIST = join(ROOT, 'dist-discovery');

const pwHome = join(process.env.HOME ?? '', '.local/state/adc-test-browser/');
let chromium;
try {
  ({ chromium } = createRequire(pwHome)('playwright'));
} catch {
  console.error(`Playwright not found at ${pwHome}node_modules. Install it there (see adc-test-browser).`);
  process.exit(2);
}

// Same browser adc-test-browser uses (Chrome for Testing). Override with SMOKE_CHROME.
const chrome =
  process.env.SMOKE_CHROME ??
  join(process.env.HOME ?? '', 'Library/Caches/ms-playwright/chromium-1208/chrome-mac-x64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing');
if (!existsSync(chrome)) {
  console.error(`Chrome for Testing not found at ${chrome}. Set SMOKE_CHROME to a Chromium binary.`);
  process.exit(2);
}
// New headless mode: unlike the headless shell, it can load extensions.
const launchOpts = { executablePath: chrome, headless: false };

const results = [];
const check = (name, ok, detail = '') => {
  results.push({ name, ok });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${ok ? '' : detail ? `  -> ${detail}` : ''}`);
};

// 1. Build, so the smoke test always runs the code that would ship.
console.log('building dist-discovery ...');
execSync('npm run -s build:discovery', { cwd: ROOT, stdio: 'ignore' });
for (const f of ['manifest.json', 'popup.html', 'popup.js', 'probe-site.js', 'probe-webmcp.js']) {
  check(`built: ${f}`, existsSync(join(DIST, f)));
}

// 2. Three fixture sites on real sockets.
const CARD = 'application/mcp-server-card+json';
const WEBMCP_PAGE = `<!doctype html><title>full</title><script>
  document.modelContext = { getTools: async () => [{ name: 'score_faf' }, { name: 'emit_agents_md' }] };
</script>`;
const sites = {
  full: (req, res) => {
    if (req.url === '/.well-known/ai-catalog.json') {
      res.writeHead(200, { 'content-type': 'application/ai-catalog+json' });
      return res.end(JSON.stringify({ entries: [{ type: CARD }, { type: 'application/a2a-card+json' }] }));
    }
    if (req.url === '/llms.txt') {
      res.writeHead(200, { 'content-type': 'text/plain; charset=utf-8' });
      return res.end('# Café\n\n> Facts for agents.\n'); // non-ASCII on purpose: bytes != characters
    }
    res.writeHead(200, { 'content-type': 'text/html' });
    res.end(WEBMCP_PAGE);
  },
  empty: (_req, res) => {
    res.writeHead(404, { 'content-type': 'text/html' });
    res.end('<!doctype html><title>empty</title>nothing here');
  },
  hostile: (req, res) => {
    if (req.url === '/.well-known/ai-catalog.json') {
      res.writeHead(200, { 'content-type': 'application/ai-catalog+json' });
      return res.end(Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), Buffer.from(JSON.stringify({ entries: [null, { type: CARD }] }))]));
    }
    if (req.url === '/llms.txt') {
      // Soft 404: 200 + an HTML page. Must NOT count as an llms.txt.
      res.writeHead(200, { 'content-type': 'text/plain' });
      return res.end('<!DOCTYPE html><html><body>Page not found</body></html>');
    }
    res.writeHead(200, { 'content-type': 'text/html' });
    res.end('<!doctype html><title>hostile</title>');
  },
};
const servers = [];
const origins = {};
for (const [name, handler] of Object.entries(sites)) {
  const s = createServer(handler);
  await new Promise((r) => s.listen(0, '127.0.0.1', r));
  servers.push(s);
  origins[name] = `http://127.0.0.1:${s.address().port}`;
}

const userData = mkdtempSync(join(tmpdir(), 'adc-smoke-'));
let context;
try {
  // 3. The built probes, injected into real pages (what chrome.scripting.executeScript does).
  const plain = await chromium.launch({ ...launchOpts, args: ['--headless=new'] });
  const probeCtx = await plain.newContext();
  const rows = async (name) => {
    const page = await probeCtx.newPage();
    await page.goto(origins[name]);
    await page.addScriptTag({ path: join(DIST, 'probe-site.js') });
    await page.addScriptTag({ path: join(DIST, 'probe-webmcp.js') });
    const site = await page.evaluate(() => window.__fafAgentDiscoverySite);
    const tools = await page.evaluate(() => window.__fafAgentDiscoveryWebMcp);
    await page.close();
    return { site, tools, by: Object.fromEntries(site.rows.map((r) => [r.id, r])) };
  };

  const full = await rows('full');
  check('full site: AI Catalog found, 2 entries', full.by['ai-catalog']?.status === 'found' && full.by['ai-catalog'].detail === '2 entries', JSON.stringify(full.by['ai-catalog']));
  check('full site: Server Card found, 1 listed', full.by['server-card']?.status === 'found' && full.by['server-card'].detail.startsWith('1 '));
  check('full site: llms.txt found, size in bytes (non-ASCII)', full.by['llms-txt']?.detail === `${Buffer.byteLength('# Café\n\n> Facts for agents.\n')} bytes`, full.by['llms-txt']?.detail);
  check('full site: WebMCP page reader returns both tools', JSON.stringify(full.tools) === JSON.stringify([{ name: 'score_faf' }, { name: 'emit_agents_md' }]), JSON.stringify(full.tools));

  const empty = await rows('empty');
  check('empty site: AI Catalog not found, Server Card skipped', empty.by['ai-catalog']?.status === 'missing' && empty.by['server-card']?.status === 'skipped');
  check('empty site: llms.txt not found', empty.by['llms-txt']?.status === 'missing');
  check('empty site: no WebMCP API reads as null', empty.tools === null, JSON.stringify(empty.tools));

  const hostile = await rows('hostile');
  check('hostile site: catalog with a BOM and null entry is still read', hostile.by['ai-catalog']?.status === 'found' && hostile.by['server-card']?.status === 'found', JSON.stringify(hostile.by['ai-catalog']));
  check('hostile site: soft-404 llms.txt is not counted as found', hostile.by['llms-txt']?.status === 'missing', JSON.stringify(hostile.by['llms-txt']));
  await plain.close();

  // 4. The popup as a real extension page.
  const realDist = realpathSync(DIST);
  const extId = createHash('sha256').update(realDist).digest('hex').slice(0, 32).replace(/./g, (c) => String.fromCharCode(97 + Number.parseInt(c, 16)));
  context = await chromium.launchPersistentContext(userData, {
    ...launchOpts,
    args: ['--headless=new', `--disable-extensions-except=${realDist}`, `--load-extension=${realDist}`],
  });
  const errors = [];
  const page = await context.newPage();
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  await page.goto(`chrome-extension://${extId}/popup.html`, { timeout: 15000 });
  await page.waitForSelector('[role="alert"], ul', { timeout: 10000 });
  const body = await page.textContent('body');
  check('popup boots as an extension page and shows its name', body.includes('Agent Discovery Check'));
  check('popup shows the byline', body.includes('By James Wolfe, .FAF Creator and AAIF Ambassador'));
  check('popup on a non-website tab says so, instead of crashing', body.includes('cannot be checked'), body.slice(0, 120));
  check('popup raised no console or page errors (CSP, bundle)', errors.length === 0, errors.join(' | '));
  const manifest = await page.evaluate(() => chrome.runtime.getManifest());
  check('loaded manifest has activeTab + scripting only, no host access', JSON.stringify([...manifest.permissions].sort()) === '["activeTab","scripting"]' && !manifest.host_permissions, JSON.stringify(manifest.permissions));
} catch (e) {
  check('smoke run completed without throwing', false, String(e?.message ?? e).split('\n')[0]);
} finally {
  await context?.close().catch(() => {});
  for (const s of servers) s.close();
  rmSync(userData, { recursive: true, force: true });
}

const failed = results.filter((r) => !r.ok).length;
console.log(`\n${results.length - failed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
