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
  /** The input schema as the page reports it (stringified, cut at 20,000 characters). */
  inputSchema?: string;
  /** Judged by the probe on the whole schema, before it was cut. */
  inputSchemaIsObject?: boolean;
  /** The schema was cut and could not be judged. */
  inputSchemaTruncated?: boolean;
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
    let ok: boolean | null;
    if (t.inputSchemaIsObject !== undefined) ok = t.inputSchemaIsObject;
    else if (t.inputSchemaTruncated) ok = null;
    else {
      try {
        const v = JSON.parse(t.inputSchema) as unknown;
        ok = typeof v === 'object' && v !== null && !Array.isArray(v);
      } catch {
        ok = false;
      }
    }
    out.push({
      id: id('input-schema'),
      tier: 'webmcp',
      level: 'must',
      // Only the shape is checked here; the schema is not validated as JSON Schema.
      title: `${t.name}: input schema is a JSON object`,
      status: ok === null ? 'skip' : ok ? 'pass' : 'fail',
      ...(ok === null
        ? { detail: 'schema too large to judge here' }
        : ok
          ? {}
          : { detail: 'not a JSON object' }),
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
  checkSite?: (target: {
    cardUrl: string;
    catalogUrl: string;
    signal?: AbortSignal;
  }) => Promise<SpecCheck[]>;
  timeoutMs?: number;
  /** The whole click is cut off after this long. Default CLICK_DEADLINE_MS. */
  deadlineMs?: number;
  /** Aborted at the click deadline; set by runChecks. */
  signal?: AbortSignal;
}

/** One click, all probes: after this the unfinished rows read Unreadable. */
export const CLICK_DEADLINE_MS = 15_000;
/** A page can register any number of WebMCP tools; only this many are listed and checked. */
export const MAX_TOOLS = 100;
const RAN_OUT_OF_TIME = 'the check ran out of time';

/** location.origin is "null" in a sandboxed document; the URL still says where the page is. */
export function pageOrigin(loc: { href: string; origin: string }): string {
  return loc.origin && loc.origin !== 'null' ? loc.origin : new URL(loc.href).origin;
}

/** An HTML page where a data file was expected (a single-page app answering 200 for every path). */
const looksLikeHtml = (text: string) => /^\s*<(!doctype|html|head|body)\b/i.test(text);

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

/** Only these statuses redirect. 300, 304 (Not Modified, the answer to a conditional GET) and 305 do not. */
const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308]);

/** Browsers hide a manual redirect as an opaque response (status 0); Node shows the real 3xx. */
export function isRedirect(r: Response): boolean {
  return r.type === 'opaqueredirect' || REDIRECT_STATUSES.has(r.status);
}

async function get(ctx: ProbeContext, url: string, method = 'GET'): Promise<Fetched> {
  const t0 = Date.now();
  if (ctx.signal?.aborted) return { ok: false, error: RAN_OUT_OF_TIME, ms: 0 };
  // One signal for this request: its own timeout, or the click deadline, whichever comes first.
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), ctx.timeoutMs ?? DEFAULT_TIMEOUT_MS);
  const onDeadline = () => ac.abort();
  ctx.signal?.addEventListener('abort', onDeadline);
  try {
    const r = await ctx.fetch(url, {
      method,
      credentials: 'omit',
      // A redirect can lead to any host, past the origin limits. Never follow one.
      redirect: 'manual',
      // Whatever the page's own Referrer-Policy says, other hosts see only the page origin.
      referrerPolicy: 'origin',
      signal: ac.signal,
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
    if (ctx.signal?.aborted) return { ok: false, error: RAN_OUT_OF_TIME, ms: Date.now() - t0 };
    return { ok: false, error: e instanceof Error ? e.message : String(e), ms: Date.now() - t0 };
  } finally {
    clearTimeout(timer);
    ctx.signal?.removeEventListener('abort', onDeadline);
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

  if (looksLikeHtml(f.text)) {
    return [
      row('ai-catalog', 'missing', {
        url,
        detail: 'answered 200 with a web page, not a catalog',
        ms: f.ms,
      }),
      row('server-card', 'skipped', { detail: 'needs an AI Catalog to list cards' }),
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
      const card = new URL(cards[0].url, url);
      if (card.protocol !== 'http:' && card.protocol !== 'https:') {
        cardRow.detail = `${cardRow.detail}; its URL is not http(s), so it was not checked`;
        return [catalogRow, cardRow];
      }
      const cardUrl = card.href;
      const checks = await ctx.checkSite({ cardUrl, catalogUrl: url, signal: ctx.signal });
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
  if (looksLikeHtml(f.text) || !f.text.trim()) {
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

const asText = (v: unknown, max: number): string => {
  try {
    return String(v ?? '').slice(0, max);
  } catch {
    return '';
  }
};

/** One tool as the page reported it, reduced to bounded, well-typed fields. */
function cleanTool(raw: unknown): WebMcpTool {
  const o = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const ann =
    o.annotations && typeof o.annotations === 'object'
      ? Object.fromEntries(
          Object.entries(o.annotations as Record<string, unknown>)
            .filter(([, v]) => typeof v === 'boolean')
            .slice(0, 20)
        )
      : null;
  return {
    name: asText(o.name, 200),
    ...(typeof o.description === 'string' ? { description: o.description.slice(0, 2000) } : {}),
    ...(typeof o.inputSchema === 'string' ? { inputSchema: o.inputSchema.slice(0, 20_000) } : {}),
    ...(typeof o.inputSchemaIsObject === 'boolean'
      ? { inputSchemaIsObject: o.inputSchemaIsObject }
      : {}),
    ...(o.inputSchemaTruncated === true ? { inputSchemaTruncated: true } : {}),
    annotations: ann as Record<string, boolean> | null,
    declarative: o.declarative === true,
  };
}

export async function probeWebMcp(ctx: ProbeContext): Promise<DiscoveryRow> {
  if (!ctx.webmcp) return row('webmcp', 'skipped', { detail: 'page reader not available' });
  const t0 = Date.now();
  try {
    const raw = await ctx.webmcp();
    const ms = Date.now() - t0;
    if (raw === null) return row('webmcp', 'missing', { detail: 'page exposes no WebMCP API', ms });
    // The page controls this value: it may be anything, and arbitrarily large.
    if (!Array.isArray(raw)) throw new Error('the page returned a tool list that is not an array');
    if (raw.length === 0)
      return row('webmcp', 'missing', { detail: 'WebMCP API present, no tools registered', ms });
    const tools = raw.slice(0, MAX_TOOLS).map(cleanTool);
    const names = tools.map((t) => t.name.slice(0, 60)).join(', ');
    return {
      ...row('webmcp', 'found', {
        detail:
          raw.length > MAX_TOOLS
            ? `${raw.length} tools; the first ${MAX_TOOLS} are checked: ${names}`
            : `${raw.length} ${raw.length === 1 ? 'tool' : 'tools'}: ${names}`,
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
  // One deadline for the whole click: unfinished probes are abandoned and their rows say so.
  const ac = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const expired = new Promise<void>((resolve) => {
    timer = setTimeout(() => {
      ac.abort();
      resolve();
    }, ctx.deadlineMs ?? CLICK_DEADLINE_MS);
  });
  const c: ProbeContext = { ...ctx, signal: ac.signal };
  const guard = <T>(p: Promise<T>, onExpiry: () => T) => Promise.race([p, expired.then(onExpiry)]);
  const late = (id: Surface) => row(id, 'unreadable', { detail: RAN_OUT_OF_TIME });
  try {
    const [catalog, llms, webmcp, github] = await Promise.all([
      guard(probeCatalog(c), () => [
        late('ai-catalog'),
        row('server-card', 'skipped', { detail: 'catalog not checked' }),
      ]),
      guard(probeLlmsTxt(c), () => late('llms-txt')),
      guard(probeWebMcp(c), () => late('webmcp')),
      guard(probeGithub(c, pageUrl), () =>
        parseGithubRepo(pageUrl) ? [late('agents-md'), late('project-faf')] : []
      ),
    ]);
    return {
      origin: ctx.origin,
      pageUrl,
      rows: [...catalog, llms, webmcp, ...github],
      ms: Date.now() - t0,
    };
  } finally {
    clearTimeout(timer);
  }
}
