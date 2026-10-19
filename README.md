# Agent Discovery Check

One click shows whether the site or repo you're on is ready for AI agents.

A Chrome extension. It reads what the site publishes for agents and checks it against the specs, each verdict linked to the section it comes from.

## What it checks

| On | Surface | How |
|---|---|---|
| Any site | **AI Catalog** (`/.well-known/ai-catalog.json`) | Published or not, plus its spec checks (MUST / SHOULD) |
| Any site | **MCP Server Card** (listed in the catalog) | Spec checks from [mcp-server-card-check](https://github.com/Wolfe-Jam/mcp-server-card-check) (SEP-2127) |
| Any site | **llms.txt** | Published or not, and its size; a soft 404 doesn't count |
| Any site | **WebMCP tools** | Each tool on the page, checked against the [WebMCP spec](https://webmachinelearning.github.io/webmcp/) (name, description, input schema; annotations as a note) |
| GitHub repo | **AGENTS.md**, **project.faf** | Present or not |

Missing isn't failing: a surface the site doesn't publish shows as grey "Not published", not as an error.

## Privacy

- **Permissions:** `activeTab` and `scripting` only. It runs when you click its icon, on that tab. No host permissions, no script on every page.
- **Read-only:** it sends GET, HEAD and OPTIONS requests only, to the site you're on and, for a Server Card the site lists on another host, to that host. At most 30 requests per click.
- **Keeps nothing:** no storage, no telemetry, no account.

## Build and test

```bash
npm ci
npm run build              # → dist-discovery/ (load it unpacked in chrome://extensions)
npm test                   # unit tests (vitest)
npm run smoke:discovery    # the built extension in real Chromium: full, empty and hostile sites
npm run typecheck && npm run lint
```

## Earlier versions

Before 2.0.0 this extension was Stack⚡️Grabber, which copied a repo's stack as text. That code is archived at the git tag [`archive/stack-grabber-1.7.0`](https://github.com/Wolfe-Jam/faf-chrome-extension/tree/archive/stack-grabber-1.7.0).

## License

MIT. By James Wolfe, .FAF Creator and AAIF Ambassador.
