/**
 * Agent Discovery Check - site probes
 *
 * Pure and fetch-injected: the same code runs in the page script (same-origin reads,
 * no extra host permission) and in tests. One row per surface, each citing its spec.
 * Presence and shape only. No score.
 */

export const AI_CATALOG_PATH = '/.well-known/ai-catalog.json';
export const LLMS_TXT_PATH = '/llms.txt';
export const SERVER_CARD_TYPE = 'application/mcp-server-card+json';

export type Surface =
  | 'ai-catalog'
  | 'server-card'
  | 'llms-txt'
  | 'webmcp'
  | 'agents-md'
  | 'project-faf';
export type RowStatus = 'found' | 'missing' | 'unreadable' | 'skipped';

export interface SpecRef {
  label: string;
  url: string;
}

export interface DiscoveryRow {
  id: Surface;
  title: string;
  status: RowStatus;
  detail?: string;
  url?: string;
  ms?: number;
  spec: SpecRef;
}

export interface WebMcpTool {
  name: string;
}

export interface ProbeContext {
  origin: string;
  fetch: typeof fetch;
  /** Reads the page's WebMCP tools. Resolves null when the page exposes no WebMCP API. */
  webmcp?: () => Promise<WebMcpTool[] | null>;
  timeoutMs?: number;
}

export const SPEC: Record<Surface, SpecRef> = {
  'ai-catalog': { label: 'AI Catalog', url: 'https://ai-catalog.io/' },
  'server-card': {
    label: 'MCP Server Card',
    url: 'https://github.com/modelcontextprotocol/ext-server-card',
  },
  'llms-txt': { label: 'llms.txt', url: 'https://llmstxt.org/' },
  webmcp: { label: 'WebMCP', url: 'https://webmachinelearning.github.io/webmcp/' },
  'agents-md': { label: 'AGENTS.md', url: 'https://agents.md/' },
  'project-faf': {
    label: 'project.faf (IANA application/vnd.faf+yaml)',
    url: 'https://www.iana.org/assignments/media-types/application/vnd.faf+yaml',
  },
};

const TITLE: Record<Surface, string> = {
  'ai-catalog': 'AI Catalog',
  'server-card': 'MCP Server Card',
  'llms-txt': 'llms.txt',
  webmcp: 'WebMCP tools',
  'agents-md': 'AGENTS.md',
  'project-faf': 'project.faf',
};

const DEFAULT_TIMEOUT_MS = 8000;
const MAX_BYTES = 1_048_576;

type Fetched =
  | { ok: true; status: number; type: string; text: string; ms: number }
  | { ok: false; error: string; ms: number };

async function get(ctx: ProbeContext, url: string, method = 'GET'): Promise<Fetched> {
  const t0 = Date.now();
  try {
    const r = await ctx.fetch(url, {
      method,
      credentials: 'omit',
      redirect: 'follow',
      signal: AbortSignal.timeout(ctx.timeoutMs ?? DEFAULT_TIMEOUT_MS),
    });
    const text = method === 'HEAD' ? '' : (await r.text()).slice(0, MAX_BYTES);
    return {
      ok: true,
      status: r.status,
      type: r.headers.get('content-type') ?? '',
      text,
      ms: Date.now() - t0,
    };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e), ms: Date.now() - t0 };
  }
}

function row(
  id: Surface,
  status: RowStatus,
  extra: Partial<Pick<DiscoveryRow, 'detail' | 'url' | 'ms'>> = {}
): DiscoveryRow {
  return { id, title: TITLE[id], status, spec: SPEC[id], ...extra };
}

/** 404 and friends: nothing there. Anything else that is not a clean 200: could not be read. */
function notFound(id: Surface, url: string, f: Fetched): DiscoveryRow | null {
  if (!f.ok) return row(id, 'unreadable', { url, detail: f.error, ms: f.ms });
  if (f.status === 404 || f.status === 410) return row(id, 'missing', { url, ms: f.ms });
  if (f.status !== 200) return row(id, 'unreadable', { url, detail: `HTTP ${f.status}`, ms: f.ms });
  return null;
}

export async function probeCatalog(ctx: ProbeContext): Promise<DiscoveryRow[]> {
  const url = ctx.origin + AI_CATALOG_PATH;
  const f = await get(ctx, url);
  const bad = notFound('ai-catalog', url, f);
  if (bad)
    return [bad, row('server-card', 'skipped', { detail: 'needs an AI Catalog to list cards' })];
  if (!f.ok) return [];

  let entries: unknown;
  try {
    entries = (JSON.parse(f.text) as { entries?: unknown }).entries;
  } catch {
    return [
      row('ai-catalog', 'unreadable', { url, detail: 'answered 200 but not JSON', ms: f.ms }),
      row('server-card', 'skipped', { detail: 'catalog not readable' }),
    ];
  }
  if (!Array.isArray(entries)) {
    return [
      row('ai-catalog', 'unreadable', { url, detail: 'JSON has no entries array', ms: f.ms }),
      row('server-card', 'skipped', { detail: 'catalog not readable' }),
    ];
  }

  const cards = entries.filter(
    (e): e is { type: string } =>
      typeof e === 'object' && e !== null && (e as { type?: unknown }).type === SERVER_CARD_TYPE
  );
  const catalogRow = row('ai-catalog', 'found', {
    url,
    detail: `${entries.length} ${entries.length === 1 ? 'entry' : 'entries'}`,
    ms: f.ms,
  });
  const cardRow = cards.length
    ? row('server-card', 'found', { url, detail: `${cards.length} listed in the catalog` })
    : row('server-card', 'missing', {
        url,
        detail: `no catalog entry of type ${SERVER_CARD_TYPE}`,
      });
  return [catalogRow, cardRow];
}

export async function probeLlmsTxt(ctx: ProbeContext): Promise<DiscoveryRow> {
  const url = ctx.origin + LLMS_TXT_PATH;
  const f = await get(ctx, url);
  const bad = notFound('llms-txt', url, f);
  if (bad) return bad;
  if (!f.ok) return row('llms-txt', 'unreadable', { url });
  // A soft 404 answers 200 with an HTML page. Real llms.txt is plain text / Markdown.
  const looksHtml = /html/i.test(f.type) || /^\s*<(!doctype|html)/i.test(f.text);
  if (looksHtml || !f.text.trim()) {
    return row('llms-txt', 'missing', {
      url,
      detail: 'answered 200 with a web page, not llms.txt',
      ms: f.ms,
    });
  }
  // Bytes, not characters: the two differ for any non-ASCII file. Reads are capped, so say so past the cap.
  const bytes = new TextEncoder().encode(f.text).length;
  const detail = f.text.length >= MAX_BYTES ? 'over 1 MiB' : `${bytes} bytes`;
  return row('llms-txt', 'found', { url, detail, ms: f.ms });
}

export async function probeWebMcp(ctx: ProbeContext): Promise<DiscoveryRow> {
  if (!ctx.webmcp) return row('webmcp', 'skipped', { detail: 'page reader not available' });
  const t0 = Date.now();
  try {
    const tools = await ctx.webmcp();
    const ms = Date.now() - t0;
    if (tools === null)
      return row('webmcp', 'missing', { detail: 'page exposes no WebMCP API', ms });
    if (tools.length === 0)
      return row('webmcp', 'missing', { detail: 'WebMCP API present, no tools registered', ms });
    return row('webmcp', 'found', {
      detail: `${tools.length} ${tools.length === 1 ? 'tool' : 'tools'}: ${tools.map((t) => t.name).join(', ')}`,
      ms,
    });
  } catch (e) {
    return row('webmcp', 'unreadable', {
      detail: e instanceof Error ? e.message : String(e),
      ms: Date.now() - t0,
    });
  }
}

const RESERVED_OWNERS = new Set([
  'settings',
  'orgs',
  'marketplace',
  'explore',
  'topics',
  'sponsors',
  'notifications',
  'pulls',
  'issues',
  'login',
  'features',
  'pricing',
  'about',
  'search',
  'new',
  'apps',
  'enterprise',
  'collections',
  'trending',
]);

/** `https://github.com/owner/repo/...` gives {owner, repo}; anything else gives null. */
export function parseGithubRepo(pageUrl: string): { owner: string; repo: string } | null {
  let u: URL;
  try {
    u = new URL(pageUrl);
  } catch {
    return null;
  }
  if (u.hostname !== 'github.com') return null;
  const [owner, repo] = u.pathname.split('/').filter(Boolean);
  if (!owner || !repo || RESERVED_OWNERS.has(owner.toLowerCase())) return null;
  return { owner, repo: repo.replace(/\.git$/, '') };
}

/** Same-origin HEAD on github.com's blob route: 200 present, 404 absent. No extra host permission. */
export async function probeGithub(ctx: ProbeContext, pageUrl: string): Promise<DiscoveryRow[]> {
  const gh = parseGithubRepo(pageUrl);
  if (!gh) return [];
  const base = `${ctx.origin}/${gh.owner}/${gh.repo}/blob/HEAD/`;
  const files: Array<[Surface, string]> = [
    ['agents-md', 'AGENTS.md'],
    ['project-faf', 'project.faf'],
  ];
  return Promise.all(
    files.map(async ([id, name]) => {
      const url = base + name;
      const f = await get(ctx, url, 'HEAD');
      return notFound(id, url, f) ?? row(id, 'found', { url, ms: f.ms });
    })
  );
}

export interface DiscoveryReport {
  origin: string;
  pageUrl: string;
  rows: DiscoveryRow[];
  ms: number;
}

/** All probes in parallel. Row order is stable: site surfaces, then GitHub surfaces. */
export async function runChecks(ctx: ProbeContext, pageUrl: string): Promise<DiscoveryReport> {
  const t0 = Date.now();
  const [catalog, llms, webmcp, github] = await Promise.all([
    probeCatalog(ctx),
    probeLlmsTxt(ctx),
    probeWebMcp(ctx),
    probeGithub(ctx, pageUrl),
  ]);
  return {
    origin: ctx.origin,
    pageUrl,
    rows: [...catalog, llms, webmcp, ...github],
    ms: Date.now() - t0,
  };
}
