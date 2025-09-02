# Claude Code CLI Prompt for FAF Chrome Extension

Build a production-quality Chrome Extension called "FAF - Fast AF" for extracting AI context from web pages.

## Core Requirements

1. **Strict TypeScript** - `strict: true` in tsconfig, no `any` types, no exceptions
2. **Chrome Manifest V3** - Modern extension architecture
3. **Performance** - Context extraction must complete in <300ms
4. **Type Safety** - Every Chrome API wrapped with proper types

## Functionality

The extension detects code/projects on any webpage and generates a ".faf" context file for AI assistants (Claude, ChatGPT, etc).

### Scoring System
- GitHub repos: Base 75% + bonus for package.json/env files
- Monaco editor: 100% (detected via window.monaco)
- CodeMirror: 85%
- Pages with code blocks: 50% + bonuses
- Regular pages: 25%

### Badge Colors (with exact hex values)
- 80-100%: Orange (#FF6B35) background, Cream (#FFF8F0) text
- 50-79%: Cyan (#5CE1E6) background, Black (#0A0A0A) text  
- 0-49%: Black (#0A0A0A) background, Orange (#FF6B35) text

## Technical Architecture
```
src/
├── core/
│   ├── engine.ts       // Main extraction logic
│   ├── types.ts        // All TypeScript interfaces
│   └── scorer.ts       // Score calculation
├── adapters/
│   ├── chrome.ts       // Chrome API type-safe wrapper
│   ├── platforms.ts    // Platform detection (GitHub, Monaco, etc)
│   └── clipboard.ts    // Clipboard operations
├── ui/
│   ├── popup.tsx       // React/Preact popup
│   └── content.ts      // Content script
├── background/
│   └── service-worker.ts
└── tests/
    └── *.test.ts       // Vitest tests
```

## Output Format

Generate a .faf file (YAML-like format):
```
.faf Context
URL: [url]
Platform: github|monaco|codemirror|unknown
Score: [0-100]%
Extracted: [ISO timestamp]

Detection
Code blocks found: [number]
Package.json detected: [boolean]
Environment vars: [boolean]

AI Instructions
Context extracted from [platform] with [score]% confidence.
[High/Medium/Low] confidence - [appropriate message]
```

## Build System

- Vite for building
- TypeScript 5.3+
- Biome for linting/formatting
- Vitest for testing

## Files Needed

1. manifest.json (with icon references)
2. TypeScript source files
3. Popup HTML/CSS (orange gradient background #FF6B35 to #FF8855)
4. Icon files: 16x16, 32x32, 48x48, 128x128 (orange smiley with lightning bolt eyes)

## Quality Requirements

- Zero TypeScript errors
- All functions have explicit return types
- Error boundaries on all user interactions
- Graceful fallbacks for all Chrome API calls
- 100% deterministic scoring
- No console.logs in production
- Comments only where necessary

## Key Features

1. One-click extraction via toolbar icon
2. Keyboard shortcut: Cmd+Shift+F (Mac) / Ctrl+Shift+F (Windows)
3. Auto-copy to clipboard
4. Visual badge showing score percentage
5. Works on all sites (graceful degradation)

## Important Context

- This is part of a larger "context-on-demand" ecosystem
- The .faf format will become a standard for AI context sharing
- Quality over features - better to have 3 perfect features than 10 buggy ones
- The code will be public on GitHub - it must be exemplary

Build this as if it's going to be reviewed by the TypeScript team at Microsoft. Every line should be defensible. No shortcuts. No compromises.

Start with the manifest.json and core type definitions, then build outward.

## Reference Implementation Notes

The reference files show the working scoring logic and color system. 
Reimplement this in strict TypeScript with proper types.

The extension has been tested and works on:
- github.com/facebook/react (scores 85%)
- Regular websites (scores 25-40%)

Current working version is in JavaScript. We need the TypeScript production version.

## Brand Colors (Critical - Must Match Exactly)
- Orange: #FF6B35
- Cream: #FFF8F0  
- Cyan: #5CE1E6
- Black: #0A0A0A

These colors are non-negotiable - they're part of the brand identity.