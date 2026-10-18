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

function schemaOf(v: unknown): string | undefined {
  if (v === undefined || v === null) return undefined;
  if (typeof v === 'string') return v.slice(0, 20_000);
  try {
    return JSON.stringify(v).slice(0, 20_000);
  } catch {
    return '<unserializable>';
  }
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
      inputSchema: schemaOf(t.inputSchema),
      annotations,
      declarative: declarative.has(name),
    };
  });
}

(globalThis as Record<string, unknown>).__fafAgentDiscoveryWebMcp = readTools();
