<!-- faf:start -->
<!-- faf: Agent Discovery Check | TypeScript |  | One click shows whether the site or repo you are on is ready for AI agents, each verdict linked to its spec section -->
<!-- faf: claim=project.faf | family=FAF -->

# CLAUDE.md — Agent Discovery Check

## What This Is

One click shows whether the site or repo you are on is ready for AI agents, each verdict linked to its spec section

## Stack

- **Language:** TypeScript
- **Framework:** Svelte
- **CSS:** slotignore
- **UI Library:** slotignore
- **State:** Svelte stores
- **Backend:** slotignore
- **Runtime:** Chrome Extension (Manifest V3)
- **Database:** slotignore
- **Build:** Vite
- **Package Manager:** npm
- **API:** REST
- **Hosting:** slotignore
- **CI/CD:** GitHub Actions (typecheck, lint, build)
- **Connection:** slotignore

## Context

- **Who:** Developers and site owners who publish for AI agents (MCP servers, AI Catalogs, WebMCP pages)
- **What:** A Chrome extension that checks what a site publishes for agents against the specs, MUST / SHOULD with links
- **Why:** A valid-looking card or catalog can still break the spec; one click shows what's published and what's off, read-only
- **Where:** Chrome toolbar, on the tab you click (activeTab + scripting only)
- **When:** When building or reviewing a site's agent-facing files (AI Catalog, Server Card, llms.txt, WebMCP tools)
- **How:** Click the icon; the extension reads the well-known files and the WebMCP tools on that page and lists each verdict

---

*STATUS: SYNC ACTIVE — 2026-10-19T04:27:38.376Z*
<!-- faf:end -->
