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

/** One spec-cited check from mcp-server-card-check, as shown under a row. */
export interface SpecCheck {
  id: string;
  tier: 'card' | 'hosting' | 'catalog' | 'webmcp';
  /** `note` reports what is declared where the spec sets no rule; it is never an issue. */
  level: 'must' | 'should' | 'note';
  title: string;
  status: 'pass' | 'fail' | 'skip' | 'info';
  detail?: string;
  spec?: SpecRef;
}

export interface DiscoveryRow {
  id: Surface;
  title: string;
  status: RowStatus;
  detail?: string;
  url?: string;
  ms?: number;
  spec: SpecRef;
  /** Spec-cited checks for this surface (AI Catalog, Server Card), when they ran. */
  checks?: SpecCheck[];
}

export interface WebMcpTool {
  name: string;
  description?: string;
  /** The input schema as the page reports it (stringified). */
  inputSchema?: string;
  annotations?: Record<string, boolean> | null;
  /** Declared by a <form toolname> rather than registerTool(). */
  declarative?: boolean;
}

const WEBMCP_SPEC = 'https://webmachinelearning.github.io/webmcp/';
const wspec = (label: string, anchor: string): SpecRef => ({
  label: `WebMCP: ${label}`,
  url: `${WEBMCP_SPEC}#${anchor}`,
});
// "between 1 and 128, inclusive, and only consist of ASCII alphanumeric code points, _, - and ."
const TOOL_NAME = /^[A-Za-z0-9_.-]{1,128}$/;

/** Checks for one WebMCP tool, from the spec's own rules (ModelContextTool, registerTool()). */
export function webMcpToolChecks(t: WebMcpTool): SpecCheck[] {
  const id = (k: string) => `webmcp.${t.name || '(unnamed)'}.${k}`;
  const out: SpecCheck[] = [];
  out.push({
    id: id('name'),
    tier: 'webmcp',
    level: 'must',
    title: `${t.name || '(unnamed)'}: name is 1–128 letters, digits, _ - or .`,
    status: TOOL_NAME.test(t.name) ? 'pass' : 'fail',
    ...(TOOL_NAME.test(t.name) ? {} : { detail: `got "${t.name.slice(0, 60)}"` }),
    spec: wspec('tool name', 'tool-definition-name'),
  });
  const hasDescription = typeof t.description === 'string' && t.description.trim().length > 0;
  out.push({
    id: id('description'),
    tier: 'webmcp',
    level: 'must',
    title: `${t.name}: has a description`,
    status: hasDescription ? 'pass' : 'fail',
    ...(hasDescription ? {} : { detail: 'description is missing or empty' }),
    spec: wspec('description', 'dom-modelcontexttool-description'),
  });
  if (t.inputSchema !== undefined) {
    let ok = false;
    try {
      const v = JSON.parse(t.inputSchema) as unknown;
      ok = typeof v === 'object' && v !== null && !Array.isArray(v);
    } catch {
      ok = false;
    }
    out.push({
      id: id('input-schema'),
      tier: 'webmcp',
      level: 'must',
      title: `${t.name}: input schema is a JSON Schema object`,
      status: ok ? 'pass' : 'fail',
      ...(ok ? {} : { detail: 'not a JSON object' }),
      spec: wspec('inputSchema', 'dom-modelcontexttool-inputschema'),
    });
  }
  const declared = Object.entries(t.annotations ?? {})
    .filter(([, v]) => v)
    .map(([k]) => k);
  out.push({
    id: id('annotations'),
    tier: 'webmcp',
    level: 'note',
    title: `${t.name}: annotations`,
    status: 'info',
    detail:
      t.declarative && !t.annotations
        ? 'none: the declarative (form) API has no way to declare annotations yet (webmcp#163)'
        : declared.length
          ? declared.join(', ')
          : 'none declared (all hints default to false)',
    spec: wspec('ToolAnnotations', 'dictdef-toolannotations'),
  });
  return out;
}

export interface ProbeContext {
  origin: string;
  fetch: typeof fetch;
  /** Reads the page's WebMCP tools. Resolves null when the page exposes no WebMCP API. */
  webmcp?: () => Promise<WebMcpTool[] | null>;
  /** Waits before a retry; tests pass a no-op. Default: setTimeout. */
  sleep?: (ms: number) => Promise<void>;
  /** Runs the spec checks for one Server Card and its catalog (read-only). */
  checkSite?: (target: { cardUrl: string; catalogUrl: string }) => Promise<SpecCheck[]>;
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
  | { ok: true; status: number; type: string; text: string; truncated: boolean; ms: number }
  | { ok: false; error: string; ms: number };

/**
 * Reads at most `max` bytes, then cancels the stream: a huge or endless body is never
 * buffered whole. TextDecoder drops a leading UTF-8 BOM, so JSON.parse never sees one.
 */
async function readCapped(
  res: Response,
  max: number
): Promise<{ text: string; truncated: boolean }> {
  if (!res.body) return { text: '', truncated: false };
  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  let truncated = false;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    if (size + value.length > max) {
      chunks.push(value.subarray(0, max - size));
      size = max;
      truncated = true;
      await reader.cancel().catch(() => undefined);
      break;
    }
    chunks.push(value);
    size += value.length;
  }
  const bytes = new Uint8Array(size);
  let at = 0;
  for (const c of chunks) {
    bytes.set(c, at);
    at += c.length;
  }
  return { text: new TextDecoder().decode(bytes), truncated };
}

/** Browsers hide a manual redirect as an opaque response (status 0); Node shows the real 3xx. */
export function isRedirect(r: Response): boolean {
  return r.type === 'opaqueredirect' || (r.status >= 300 && r.status < 400);
}

async function get(ctx: ProbeContext, url: string, method = 'GET'): Promise<Fetched> {
  const t0 = Date.now();
  try {
    const r = await ctx.fetch(url, {
      method,
      credentials: 'omit',
      // A redirect can lead to any host, past the origin limits. Never follow one.
      redirect: 'manual',
      // Whatever the page's own Referrer-Policy says, other hosts see only the page origin.
      referrerPolicy: 'origin',
      signal: AbortSignal.timeout(ctx.timeoutMs ?? DEFAULT_TIMEOUT_MS),
    });
    if (isRedirect(r)) {
      await r.body?.cancel();
      return { ok: false, error: 'redirects are not followed', ms: Date.now() - t0 };
    }
    const { text, truncated } =
      method === 'HEAD' ? { text: '', truncated: false } : await readCapped(r, MAX_BYTES);
    return {
      ok: true,
      status: r.status,
      type: r.headers.get('content-type') ?? '',
      text,
      truncated,
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
  if (f.truncated) {
    return [
      row('ai-catalog', 'unreadable', { url, detail: 'larger than 1 MiB', ms: f.ms }),
      row('server-card', 'skipped', { detail: 'catalog not readable' }),
    ];
  }

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
    (e): e is { type: string; url?: unknown } =>
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
  if (cards.length && ctx.checkSite && typeof cards[0].url === 'string') {
    try {
      const cardUrl = new URL(cards[0].url, url).href;
      const checks = await ctx.checkSite({ cardUrl, catalogUrl: url });
      catalogRow.checks = checks.filter((c) => c.tier === 'catalog');
      cardRow.checks = checks.filter((c) => c.tier !== 'catalog');
      cardRow.url = cardUrl;
      if (cards.length > 1)
        cardRow.detail = `${cards.length} listed in the catalog; the first is checked`;
    } catch (e) {
      cardRow.detail = `${cardRow.detail}; checks could not run (${e instanceof Error ? e.message : String(e)})`;
    }
  }
  return [catalogRow, cardRow];
}

/** Failed checks under a row, MUST first. */
export function issues(row: DiscoveryRow): { must: number; should: number } {
  const failed = (row.checks ?? []).filter((c) => c.status === 'fail');
  return {
    must: failed.filter((c) => c.level === 'must').length,
    should: failed.filter((c) => c.level === 'should').length,
  };
}

export async function probeLlmsTxt(ctx: ProbeContext): Promise<DiscoveryRow> {
  const url = ctx.origin + LLMS_TXT_PATH;
  const f = await get(ctx, url);
  const bad = notFound('llms-txt', url, f);
  if (bad) return bad;
  if (!f.ok) return row('llms-txt', 'unreadable', { url });
  // A soft 404 answers 200 with an HTML page. Judge the body, not the header: a real llms.txt
  // served as text/html (a common misconfiguration) is still an llms.txt.
  const looksHtml = /^\s*<(!doctype|html|head|body)\b/i.test(f.text);
  if (looksHtml || !f.text.trim()) {
    return row('llms-txt', 'missing', {
      url,
      detail: 'answered 200 with a web page, not llms.txt',
      ms: f.ms,
    });
  }
  // Bytes, not characters: the two differ for any non-ASCII file. Reads are capped, so say so past the cap.
  const bytes = new TextEncoder().encode(f.text).length;
  const detail = f.truncated ? 'over 1 MiB' : `${bytes} bytes`;
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
    return {
      ...row('webmcp', 'found', {
        detail: `${tools.length} ${tools.length === 1 ? 'tool' : 'tools'}: ${tools.map((t) => t.name).join(', ')}`,
        ms,
      }),
      checks: tools.flatMap(webMcpToolChecks),
    };
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
/** Waits before each retry after GitHub answers 429 (then gives up and says so). */
export const GITHUB_RETRY_MS = [1500, 3000];

export async function probeGithub(ctx: ProbeContext, pageUrl: string): Promise<DiscoveryRow[]> {
  const gh = parseGithubRepo(pageUrl);
  if (!gh) return [];
  const base = `${ctx.origin}/${gh.owner}/${gh.repo}/blob/HEAD/`;
  const files: Array<[Surface, string]> = [
    ['agents-md', 'AGENTS.md'],
    ['project-faf', 'project.faf'],
  ];
  const sleep = ctx.sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));
  const rows: DiscoveryRow[] = [];
  // One file at a time: the repo page already makes many requests, and GitHub rate-limits bursts.
  for (const [id, name] of files) {
    const url = base + name;
    let f = await get(ctx, url, 'HEAD');
    let ms = f.ms;
    for (const wait of GITHUB_RETRY_MS) {
      if (!(f.ok && f.status === 429)) break;
      await sleep(wait);
      f = await get(ctx, url, 'HEAD');
      ms += wait + f.ms;
    }
    if (f.ok && f.status === 429) {
      rows.push(
        row(id, 'unreadable', {
          url,
          detail: 'GitHub is rate-limiting requests (HTTP 429); click Check again in a moment',
          ms,
        })
      );
      continue;
    }
    rows.push(notFound(id, url, { ...f, ms }) ?? row(id, 'found', { url, ms }));
  }
  return rows;
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
