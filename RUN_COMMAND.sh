#!/bin/bash

# FAF Chrome Extension - Production Build with Claude Code CLI
# Run this command to build the production-quality TypeScript version

echo "🏎️ Starting FAF Chrome Extension Production Build..."

# Navigate to the production directory
cd "$(dirname "$0")"

# Verify assets are present
if [ ! -d "icons" ]; then
    echo "❌ Icons directory missing!"
    exit 1
fi

if [ ! -f "reference/scoring-logic.js" ]; then
    echo "❌ Reference logic missing!"
    exit 1
fi

echo "✅ Assets verified"

# The Claude Code CLI command
echo "🚀 Running Claude Code CLI..."

claude_code \
    --include "icons/social-logo-*.png" \
    --include "reference/scoring-logic.js" \
    --include "reference/current-types.ts" \
    --prompt "$(cat CLAUDE_CODE_PROMPT.md)"

echo "🏁 FAF Extension build complete!"
echo ""
echo "Next steps:"
echo "1. cd into the generated project"
echo "2. npm install"
echo "3. npm run build"
echo "4. Load the extension in Chrome"