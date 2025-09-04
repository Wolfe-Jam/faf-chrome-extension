# 🎯 Gemini CLI Task: Fix FAF Chrome Extension Scoring

## Critical Issue
The FAF Chrome Extension gives **wrong scores** (Monaco Editor = 9% instead of 90-100%).

## Your Mission
Port the **working faf-engine Mk-1** scoring logic into the Chrome Extension so it gives correct scores.

## File Locations

### ✅ WORKING ENGINE (Use as Reference)
**Location**: `/Users/wolfejam/faf-cli/faf-engine/`

Key files:
- `src/core/FafEngine.ts` - Main engine logic
- `src/scoring/ScoreCalculator.ts` - Correct scoring algorithm
- `src/constants.ts` - Contains `ENGINE_NAME = '.faf-engine Mk-1'`

This engine **correctly** scores Monaco at 100% in under 300ms.

### ❌ BROKEN CHROME EXTENSION (Fix This)
**Location**: `/Users/wolfejam/faf-production/`

Problem files:
- `src/core/browser-faf-engine.ts` - Broken, gives 9% for Monaco
- `src/core/engine.ts` - Uses the broken browser engine
- `src/core/scorer.ts` - Old fake scoring system

## Requirements
1. Port the **real faf-engine Mk-1 logic** to work in browser environment
2. NO Node.js dependencies (no 'fs', 'path', etc.)
3. Must build: `npm run build` without errors
4. TypeScript strict compliance

## Test Procedure
```bash
cd /Users/wolfejam/faf-production
npm run build
# Load /Users/wolfejam/faf-production/dist/ in Chrome as unpacked extension
# Test on https://github.com/microsoft/monaco-editor
```

## Success Criteria
- Monaco Editor: **90-100%** score (currently 9%)
- React Repository: **85-95%** score (currently 45%)
- Real content analysis, NOT fake predetermined scores

## Quality Standard
Production-ready for **🏎️⚡️Wolfejam** brand. No shortcuts.

## Current Status
- Build succeeds ✅
- Scoring is completely wrong ❌
- Need to use **faf-engine Mk-1** logic ⚡

**Note**: The engine is officially called "faf-engine Mk-1" (Mark 1). This is the ONLY working engine.