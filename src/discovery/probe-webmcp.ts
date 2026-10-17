/**
 * Injected into the page (MAIN world) on click: only the page's own JavaScript can see
 * document.modelContext. Resolves null when the page exposes no WebMCP API.
 */

interface ToolLike {
  name?: unknown;
}

interface ModelContextLike {
  getTools?: () => Promise<ToolLike[]>;
}

interface TestingLike {
  listTools?: () => Promise<ToolLike[]>;
}

async function readTools(): Promise<Array<{ name: string }> | null> {
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

  const tools = await list();
  return tools.map((t) => ({ name: String(t.name ?? '') }));
}

(globalThis as Record<string, unknown>).__fafAgentDiscoveryWebMcp = readTools();
