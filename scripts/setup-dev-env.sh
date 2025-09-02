#!/bin/bash

# Development Environment Setup Script for FAF Chrome Extension
# Sets up git hooks, IDE configurations, and development tools

set -e

echo "🚀 Setting up FAF Chrome Extension development environment..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    print_error "package.json not found. Please run this script from the project root."
    exit 1
fi

# Check if this is the FAF extension project
if ! grep -q "faf-chrome-extension" package.json; then
    print_error "This doesn't appear to be the FAF Chrome Extension project."
    exit 1
fi

print_status "Setting up development environment for FAF Chrome Extension..."

# 1. Install dependencies
print_status "Installing dependencies..."
npm install
print_success "Dependencies installed"

# 2. Setup git hooks
print_status "Setting up git hooks..."
mkdir -p .git/hooks

# Copy pre-commit hook
cp .github/hooks/pre-commit .git/hooks/pre-commit
chmod +x .git/hooks/pre-commit
print_success "Pre-commit hook installed"

# Create commit message template
cat > .git/hooks/prepare-commit-msg << 'EOF'
#!/bin/sh

# Git commit message template
# Conventional commits format

COMMIT_MSG_FILE=$1
COMMIT_SOURCE=$2
SHA1=$3

# Only add template for new commits (not merges/amendments)
if [ -z "$COMMIT_SOURCE" ]; then
    cat >> $COMMIT_MSG_FILE << 'TEMPLATE'

# Conventional Commits Format:
# feat: add new feature
# fix: resolve bug  
# docs: update documentation
# style: format code (no functional changes)
# refactor: improve code structure
# test: add/update tests
# chore: maintenance tasks
# 
# Examples:
# feat(ui): add dark mode toggle
# fix(auth): resolve login timeout issue
# docs: update API documentation
# 
# Body (optional): Explain the what and why
# 
# Footer (optional): Reference issues
# Closes #123
# BREAKING CHANGE: describe breaking changes
TEMPLATE
fi
EOF

chmod +x .git/hooks/prepare-commit-msg
print_success "Commit message template installed"

# 3. Setup VS Code configuration
print_status "Setting up VS Code configuration..."
mkdir -p .vscode

# VS Code settings
cat > .vscode/settings.json << 'EOF'
{
  // Editor settings
  "editor.formatOnSave": true,
  "editor.codeActionsOnSave": {
    "source.fixAll": "explicit",
    "source.organizeImports": "explicit"
  },
  "editor.rulers": [80, 120],
  "editor.tabSize": 2,
  "editor.insertSpaces": true,
  "editor.trimAutoWhitespace": true,
  
  // TypeScript settings
  "typescript.preferences.importModuleSpecifier": "relative",
  "typescript.suggest.autoImports": true,
  "typescript.updateImportsOnFileMove.enabled": "always",
  
  // Biome formatter
  "[typescript]": {
    "editor.defaultFormatter": "biomejs.biome"
  },
  "[typescriptreact]": {
    "editor.defaultFormatter": "biomejs.biome"
  },
  "[javascript]": {
    "editor.defaultFormatter": "biomejs.biome"
  },
  "[javascriptreact]": {
    "editor.defaultFormatter": "biomejs.biome"
  },
  "[json]": {
    "editor.defaultFormatter": "biomejs.biome"
  },
  
  // File associations
  "files.associations": {
    "*.json": "jsonc"
  },
  
  // Search settings
  "search.exclude": {
    "**/node_modules": true,
    "**/dist": true,
    "**/coverage": true,
    "**/*.map": true
  },
  
  // Extension recommendations
  "extensions.autoUpdate": false,
  
  // Chrome extension specific
  "emmet.includeLanguages": {
    "typescript": "html",
    "typescriptreact": "html"
  }
}
EOF

# VS Code extensions recommendations
cat > .vscode/extensions.json << 'EOF'
{
  "recommendations": [
    "biomejs.biome",
    "bradlc.vscode-tailwindcss",
    "ms-vscode.vscode-typescript-next",
    "vitest.explorer",
    "usernamehw.errorlens",
    "streetsidesoftware.code-spell-checker",
    "github.vscode-pull-request-github",
    "ms-vscode.vscode-json"
  ],
  "unwantedRecommendations": [
    "ms-vscode.vscode-eslint",
    "esbenp.prettier-vscode"
  ]
}
EOF

# VS Code tasks
cat > .vscode/tasks.json << 'EOF'
{
  "version": "2.0.0",
  "tasks": [
    {
      "label": "dev",
      "type": "npm",
      "script": "dev",
      "group": "build",
      "presentation": {
        "echo": true,
        "reveal": "always",
        "focus": false,
        "panel": "shared",
        "showReuseMessage": true,
        "clear": false
      },
      "isBackground": true,
      "problemMatcher": {
        "owner": "typescript",
        "fileLocation": "relative",
        "pattern": {
          "regexp": "^([^\\s].*)\\((\\d+|\\d+,\\d+|\\d+,\\d+,\\d+,\\d+)\\):\\s+(error|warning|info)\\s+(TS\\d+)\\s*:\\s*(.*)$",
          "file": 1,
          "location": 2,
          "severity": 3,
          "code": 4,
          "message": 5
        },
        "background": {
          "activeOnStart": true,
          "beginsPattern": "Starting compilation",
          "endsPattern": "Found 0 errors"
        }
      }
    },
    {
      "label": "build",
      "type": "npm",
      "script": "build",
      "group": "build"
    },
    {
      "label": "test",
      "type": "npm",
      "script": "test",
      "group": "test"
    },
    {
      "label": "lint",
      "type": "npm",
      "script": "lint",
      "group": "build"
    },
    {
      "label": "typecheck",
      "type": "npm",
      "script": "typecheck",
      "group": "build"
    }
  ]
}
EOF

# VS Code launch configuration for debugging
cat > .vscode/launch.json << 'EOF'
{
  "version": "0.2.0",
  "configurations": [
    {
      "name": "Debug Tests",
      "type": "node",
      "request": "launch",
      "program": "${workspaceFolder}/node_modules/.bin/vitest",
      "args": ["--run"],
      "cwd": "${workspaceFolder}",
      "console": "integratedTerminal",
      "internalConsoleOptions": "neverOpen"
    },
    {
      "name": "Debug Extension",
      "type": "chrome",
      "request": "launch",
      "url": "chrome://extensions/",
      "webRoot": "${workspaceFolder}/dist"
    }
  ]
}
EOF

print_success "VS Code configuration created"

# 4. Setup environment files
print_status "Setting up environment configuration..."

# Create .env.example
cat > .env.example << 'EOF'
# Environment Configuration for FAF Chrome Extension
NODE_ENV=development

# Telemetry Configuration (optional)
TELEMETRY_ENDPOINT=https://your-analytics-endpoint.com/api

# Development Settings
DEBUG_MODE=true
VERBOSE_LOGGING=false

# Build Settings
SOURCE_MAPS=true
MINIFY=false
EOF

# Create .env.local if it doesn't exist
if [ ! -f ".env.local" ]; then
    cp .env.example .env.local
    print_success "Created .env.local from template"
else
    print_warning ".env.local already exists, skipping..."
fi

print_success "Environment files configured"

# 5. Setup development scripts
print_status "Creating development helper scripts..."

# Create development script runner
cat > scripts/dev.sh << 'EOF'
#!/bin/bash

# Development helper script

case "$1" in
    "install")
        echo "🔧 Installing extension for development..."
        npm run build
        echo ""
        echo "📦 Extension built successfully!"
        echo "🔗 Load the extension in Chrome:"
        echo "   1. Open chrome://extensions/"
        echo "   2. Enable 'Developer mode'"
        echo "   3. Click 'Load unpacked'"
        echo "   4. Select the 'dist' folder"
        ;;
    "reload")
        echo "🔄 Reloading extension..."
        npm run build
        echo "✅ Extension rebuilt! Reload in Chrome extensions page."
        ;;
    "test:watch")
        echo "🧪 Running tests in watch mode..."
        npm run test
        ;;
    "clean")
        echo "🧹 Cleaning build artifacts..."
        npm run clean
        echo "✅ Clean complete"
        ;;
    *)
        echo "🛠️ FAF Extension Development Helper"
        echo ""
        echo "Usage: ./scripts/dev.sh <command>"
        echo ""
        echo "Commands:"
        echo "  install    Build and show installation instructions"
        echo "  reload     Rebuild extension for development"  
        echo "  test:watch Run tests in watch mode"
        echo "  clean      Clean build artifacts"
        ;;
esac
EOF

chmod +x scripts/dev.sh
print_success "Development helper script created"

# 6. Setup GitHub CLI configuration (if available)
if command -v gh >/dev/null 2>&1; then
    print_status "Setting up GitHub CLI configuration..."
    
    # Create GitHub CLI extension for common tasks
    cat > scripts/gh-helpers.sh << 'EOF'
#!/bin/bash

# GitHub CLI helpers for FAF Extension

case "$1" in
    "pr")
        echo "🔄 Creating pull request..."
        gh pr create --web
        ;;
    "status")
        echo "📊 Repository status:"
        gh repo view --web
        echo ""
        echo "🔄 Recent activity:"
        gh pr list --limit 5
        ;;
    "ci")
        echo "🚀 CI/CD status:"
        gh run list --limit 5
        ;;
    *)
        echo "🐙 GitHub CLI Helpers"
        echo ""
        echo "Usage: ./scripts/gh-helpers.sh <command>"
        echo ""
        echo "Commands:"
        echo "  pr      Create pull request"
        echo "  status  Show repository status"
        echo "  ci      Show CI/CD status"
        ;;
esac
EOF
    
    chmod +x scripts/gh-helpers.sh
    print_success "GitHub CLI helpers created"
fi

# 7. Create development documentation
print_status "Creating development documentation..."

cat > DEVELOPMENT.md << 'EOF'
# Development Guide

## Quick Start

1. **Setup development environment:**
   ```bash
   ./scripts/setup-dev-env.sh
   ```

2. **Start development mode:**
   ```bash
   npm run dev
   ```

3. **Install in Chrome:**
   ```bash
   ./scripts/dev.sh install
   ```

## Development Workflow

### Daily Development
```bash
# Start development with file watching
npm run dev

# Run tests in watch mode  
npm run test

# Type check
npm run typecheck

# Lint and format
npm run lint:fix
npm run format
```

### Before Committing
The pre-commit hook will automatically:
- ✅ Type check TypeScript files
- ✅ Run linter and auto-fix issues
- ✅ Format code with Biome
- ✅ Run tests
- ✅ Check for debug statements
- ✅ Security scan for sensitive data

### Building and Testing
```bash
# Production build
npm run build:prod

# Package for distribution
npm run package

# Run performance tests
node scripts/performance-test.js

# Deploy to different environments
node scripts/deploy.js deploy development
node scripts/deploy.js deploy staging  
node scripts/deploy.js deploy production
```

## VS Code Integration

### Recommended Extensions
- Biome (linting & formatting)
- TypeScript + Vue/React support
- Vitest Test Explorer
- Error Lens
- Code Spell Checker

### Useful Shortcuts
- `Ctrl+Shift+P` → "Tasks: Run Task" → Select development task
- `F5` → Start debugging
- `Ctrl+Shift+F5` → Reload extension

## Project Structure
```
src/
├── background/     # Service worker
├── ui/            # Content scripts and popup
├── core/          # Core business logic
├── adapters/      # External integrations
└── tests/         # Test files

scripts/           # Development and deployment scripts
.github/           # CI/CD workflows and hooks
```

## Troubleshooting

### Common Issues
1. **Extension not loading:** Check console for errors in `chrome://extensions/`
2. **Hot reload not working:** Restart dev server with `npm run dev`
3. **Tests failing:** Clear cache with `npm run clean`
4. **Type errors:** Run `npm run typecheck` for detailed errors

### Performance Issues
- Run `node scripts/performance-test.js` to analyze bundle size
- Check memory usage in Chrome DevTools
- Profile service worker performance

## Contributing

1. Create feature branch: `git checkout -b feature/your-feature`
2. Make changes and test thoroughly
3. Commit with conventional format: `feat: add new feature`
4. Push and create PR: `./scripts/gh-helpers.sh pr`

## Deployment

See `scripts/deploy.js` for deployment options:
- Development: Local testing
- Staging: Pre-production validation  
- Production: Chrome Web Store release
EOF

print_success "Development documentation created"

# 8. Final validation
print_status "Running validation checks..."

# Check if TypeScript compiles
if npm run typecheck >/dev/null 2>&1; then
    print_success "TypeScript compilation check passed"
else
    print_warning "TypeScript compilation has issues - run 'npm run typecheck' to see details"
fi

# Check if linting passes
if npm run lint >/dev/null 2>&1; then
    print_success "Linting check passed"  
else
    print_warning "Linting issues found - run 'npm run lint:fix' to auto-fix"
fi

# Create a simple build test
if npm run build >/dev/null 2>&1; then
    print_success "Build test passed"
    npm run clean >/dev/null 2>&1
else
    print_warning "Build test failed - check your configuration"
fi

echo ""
print_success "🎉 Development environment setup complete!"
echo ""
echo "📋 Next steps:"
echo "1. Review and edit .env.local for your local settings"
echo "2. Run 'npm run dev' to start development"
echo "3. Run './scripts/dev.sh install' to load extension in Chrome"
echo "4. Read DEVELOPMENT.md for detailed workflow guide"
echo ""
echo "🛠️ Available commands:"
echo "   npm run dev          # Start development mode"
echo "   npm run test         # Run tests"
echo "   npm run build:prod   # Production build"
echo "   ./scripts/dev.sh     # Development helpers"
echo ""
echo "Happy coding! 🚀"