/**
 * Injected into the page (MAIN world) on click: only the page's own JavaScript can see
 * document.modelContext. Resolves null when the page exposes no WebMCP API.
 *
 * Returns each tool as the page reports it (name, description, inputSchema, annotations),
 * marked declarative when a <form toolname> on the page declares it.
 */

interface ToolLike {
  name?: unknown;
  description?: unknown;
  inputSchema?: unknown;
  annotations?: unknown;
}

interface ModelContextLike {
  getTools?: () => Promise<ToolLike[]>;
}

interface TestingLike {
  listTools?: () => Promise<ToolLike[]>;
}

const MAX_TEXT = 2000;

const SCHEMA_MAX = 20_000;

/** Judges the schema's shape on the whole value, then ships at most SCHEMA_MAX characters of it. */
function schemaInfo(v: unknown): {
  inputSchema?: string;
  inputSchemaIsObject?: boolean;
  inputSchemaTruncated?: boolean;
} {
  if (v === undefined || v === null) return {};
  let text: string;
  let isObject: boolean | undefined;
  if (typeof v === 'string') {
    text = v;
    if (v.length <= 1_000_000) {
      try {
        const p = JSON.parse(v) as unknown;
        isObject = typeof p === 'object' && p !== null && !Array.isArray(p);
      } catch {
        isObject = false;
      }
    }
  } else {
    try {
      text = JSON.stringify(v) ?? '';
    } catch {
      return { inputSchema: '<unserializable>', inputSchemaIsObject: false };
    }
    isObject = typeof v === 'object' && !Array.isArray(v);
  }
  return {
    inputSchema: text.slice(0, SCHEMA_MAX),
    ...(isObject === undefined ? {} : { inputSchemaIsObject: isObject }),
    ...(text.length > SCHEMA_MAX ? { inputSchemaTruncated: true } : {}),
  };
}

async function readTools() {
  const doc = document as unknown as { modelContext?: ModelContextLike };
  const nav = navigator as unknown as {
    modelContext?: ModelContextLike;
    modelContextTesting?: TestingLike;
  };
  const mc = doc.modelContext ?? nav.modelContext;
  if (!mc) return null;

  const list =
    mc.getTools?.bind(mc) ?? nav.modelContextTesting?.listTools?.bind(nav.modelContextTesting);
  if (!list) throw new Error('WebMCP is present but the page does not let tools be listed');

  const declarative = new Set(
    [...document.querySelectorAll('form[toolname]')].map((f) => f.getAttribute('toolname') ?? '')
  );
  const tools = await list();
  return tools.map((t) => {
    const name = String(t.name ?? '');
    const annotations =
      t.annotations && typeof t.annotations === 'object'
        ? Object.fromEntries(
            Object.entries(t.annotations as Record<string, unknown>).filter(
              ([, v]) => typeof v === 'boolean'
            )
          )
        : null;
    return {
      name,
      description: typeof t.description === 'string' ? t.description.slice(0, MAX_TEXT) : undefined,
      ...schemaInfo(t.inputSchema),
      annotations,
      declarative: declarative.has(name),
    };
  });
}

(globalThis as Record<string, unknown>).__fafAgentDiscoveryWebMcp = readTools();

// Makes this file a module so a test can import it; the build still emits one self-running script.
export {};
