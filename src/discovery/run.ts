/**
 * Runs the Agent Discovery Check on one tab: inject the two probes, read both results,
 * and join them into one report. The popup calls this with the active tab.
 */

import { type DiscoveryReport, type WebMcpTool, probeWebMcp } from '@/core/discovery';

export type TabRun = { ok: true; report: DiscoveryReport } | { ok: false; reason: string };

/** The slice of chrome.scripting this module uses; tests pass a fake. */
export interface ScriptingApi {
  executeScript: (injection: {
    target: { tabId: number };
    world?: 'ISOLATED' | 'MAIN';
    files?: string[];
    func?: (key: string) => unknown;
    args?: string[];
  }) => Promise<Array<{ result?: unknown }>>;
}

/** The real chrome.scripting, adapted to the narrow ScriptingApi (its own type is a files-or-func union). */
export const chromeScripting: ScriptingApi = {
  executeScript: (injection) =>
    chrome.scripting.executeScript(
      injection as chrome.scripting.ScriptInjection<string[], unknown>
    ),
};

const SITE_KEY = '__fafAgentDiscoverySite';
const WEBMCP_KEY = '__fafAgentDiscoveryWebMcp';

export function isCheckable(url: string | undefined): url is string {
  return !!url && /^https?:\/\//i.test(url);
}

async function readInjected<T>(
  scripting: ScriptingApi,
  tabId: number,
  file: string,
  key: string,
  world: 'ISOLATED' | 'MAIN'
): Promise<T> {
  await scripting.executeScript({ target: { tabId }, world, files: [file] });
  const [first] = await scripting.executeScript({
    target: { tabId },
    world,
    // func is serialized into the page, so it cannot close over variables: the key goes in args.
    // Read the result, then remove the global: a page must not be able to see that a check ran.
    func: (k: string) => {
      const g = globalThis as Record<string, unknown>;
      const v = g[k];
      delete g[k];
      return v;
    },
    args: [key],
  });
  return first?.result as T;
}

/** The page's own getTools()/listTools() can never resolve; the read is cut off after this long. */
export const WEBMCP_TIMEOUT_MS = 3000;

function withDeadline<T>(p: Promise<T>, ms: number, message: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout>;
  return Promise.race([
    p,
    new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error(message)), ms);
    }),
  ]).finally(() => clearTimeout(timer));
}

export async function discoverTab(
  tab: { id?: number; url?: string },
  scripting: ScriptingApi,
  opts: { webmcpTimeoutMs?: number } = {}
): Promise<TabRun> {
  if (
    tab.url &&
    /^https:\/\/(chromewebstore\.google\.com|chrome\.google\.com\/webstore)(\/|$)/i.test(tab.url)
  ) {
    return {
      ok: false,
      reason:
        "Chrome doesn't let extensions check the Chrome Web Store. Open another site and click again.",
    };
  }
  if (tab.id === undefined || !isCheckable(tab.url)) {
    return {
      ok: false,
      reason: 'This page cannot be checked. Open a website (http or https) and click again.',
    };
  }
  const tabId = tab.id;

  // Both reads start together, so one click costs the longer of the two, not their sum.
  const siteRead = readInjected<DiscoveryReport>(
    scripting,
    tabId,
    'probe-site.js',
    SITE_KEY,
    'ISOLATED'
  );
  const toolsRead = withDeadline(
    readInjected<WebMcpTool[] | null>(scripting, tabId, 'probe-webmcp.js', WEBMCP_KEY, 'MAIN'),
    opts.webmcpTimeoutMs ?? WEBMCP_TIMEOUT_MS,
    'the page did not list its tools in time'
  );
  const [siteResult, toolsResult] = await Promise.allSettled([siteRead, toolsRead]);

  if (siteResult.status === 'rejected') {
    const e = siteResult.reason;
    return {
      ok: false,
      reason: `Could not read this page: ${e instanceof Error ? e.message : String(e)}`,
    };
  }
  const site = siteResult.value;
  if (!site || !Array.isArray(site.rows))
    return { ok: false, reason: 'The page did not return a result.' };

  // The page's own WebMCP API is only visible from the MAIN world. A failure here only affects that one row.
  const tools: WebMcpTool[] | null = toolsResult.status === 'fulfilled' ? toolsResult.value : null;
  const webmcpError: Error | null =
    toolsResult.status === 'rejected'
      ? toolsResult.reason instanceof Error
        ? toolsResult.reason
        : new Error(String(toolsResult.reason))
      : null;

  const webmcpRow = await probeWebMcp({
    origin: site.origin,
    fetch,
    webmcp: async () => {
      if (webmcpError) throw webmcpError;
      return tools ?? null;
    },
  });
  const rows = site.rows.map((r) => (r.id === 'webmcp' ? webmcpRow : r));
  return { ok: true, report: { ...site, rows } };
}
