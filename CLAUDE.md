# Claude Development Context for FAF Chrome Extension

This file provides comprehensive context for Claude Code to effectively work with the FAF (Fast AF AI Context) Chrome extension project.

## Project Overview

**FAF** is a lightning-fast Chrome extension for AI context extraction. It intelligently analyzes codebases, documentation, and development environments to generate structured `.faf` files that provide AI assistants with perfect context for projects.

## Key Project Details

- **Type**: Chrome Extension (Manifest V3)
- **Primary Language**: TypeScript
- **UI Framework**: Svelte 5 with Runes
- **Architecture**: Extension popup + Content scripts + Service worker
- **Build Tool**: Vite
- **License**: MIT
- **Version**: 1.0.1

## Development Commands

```bash
# Install dependencies
npm install

# Development mode with hot reload
npm run dev

# Build for production
npm run build

# Run tests
npm test
npm run test:coverage

# Linting and formatting  
npm run lint
npm run lint:fix
npm run format

# Type checking
npx tsc --noEmit
```

## Project Structure

```
faf-production/
├── src/
│   ├── core/              # Core FAF engine and algorithms
│   │   ├── engine.ts      # Main extraction engine
│   │   ├── types.ts       # TypeScript type definitions
│   │   ├── errors.ts      # Error handling and recovery
│   │   ├── scoring.ts     # Context quality scoring
│   │   └── telemetry.ts   # Anonymous usage analytics
│   ├── adapters/          # Platform-specific adapters
│   │   ├── chrome.ts      # Chrome extension APIs
│   │   ├── clipboard.ts   # Clipboard operations
│   │   └── platforms/     # Platform detection and extraction
│   ├── ui/                # User interface components
│   │   ├── popup.svelte   # Extension popup interface
│   │   └── content.ts     # Content script for page interaction
│   └── background/        # Service worker
├── public/                # Extension assets
│   ├── manifest.json      # Chrome extension manifest
│   └── icons/            # Extension icons
├── tests/                 # Test suites
└── dist/                 # Built extension files (generated)
```

## Chrome Extension Architecture

### Manifest V3 Components

1. **Popup UI** (`src/ui/popup.svelte`)
   - Built with Svelte 5
   - Main user interface for context extraction
   - Displays quality scores and platform detection

2. **Content Scripts** (`src/ui/content.ts`)
   - Injected into all web pages
   - Handles platform detection and DOM analysis
   - Communicates with popup via Chrome messaging API

3. **Service Worker** (`src/background/`)
   - Handles keyboard shortcuts (Ctrl+Shift+F)
   - Manages extension lifecycle
   - Coordinates between popup and content scripts

### Key Permissions

- `activeTab` - Access current tab for context extraction
- `storage` - Store user preferences and settings
- `notifications` - Show extraction status notifications
- `scripting` - Execute content scripts
- `clipboardWrite` - Copy extracted context to clipboard
- `<all_urls>` - Work on any website

## Supported Platforms

The extension intelligently detects and extracts context from:

- **GitHub** - Repository files, README detection, dependency analysis
- **Monaco Editor** - Multi-file extraction, language detection  
- **CodeSandbox** - Project structure, live file content
- **StackBlitz** - WebContainer integration, real-time analysis
- **CodeMirror** - Code block extraction, basic structure
- **VS Code Web** - File content, workspace detection
- **Generic Sites** - Code block identification

## Core Technologies

### TypeScript Configuration
- Strict mode enabled
- No `any` types without justification
- Explicit return types for public methods
- Path mapping with `@/` prefix for `src/`

### Svelte 5 Features
- Uses Runes for state management
- Component composition patterns
- Reactive declarations with `$:` syntax
- Store-based state management

### Chrome Extension APIs Used
- `chrome.tabs` - Tab management and communication
- `chrome.storage` - Persistent settings storage
- `chrome.scripting` - Dynamic content script injection
- `chrome.commands` - Keyboard shortcut handling
- `chrome.notifications` - User feedback
- `chrome.runtime` - Extension lifecycle and messaging

## Performance Targets

- **⚡ < 300ms** average extraction time
- **🎯 95%+** accuracy on supported platforms
- **📦 < 70KB** extension size
- **🔄 < 5MB** memory usage
- **⚖️ 0** network requests (offline operation)

## Security & Privacy

- **No data collection** - Everything runs locally
- **No network requests** - Complete offline operation
- **No sensitive data storage** - Temporary extraction only
- **CSP compliant** - Works on security-focused sites

## Testing Strategy

### Unit Tests
- Core engine functionality
- Platform adapter logic
- Error handling scenarios
- Utility functions

### Integration Tests  
- Chrome extension API interactions
- Platform detection accuracy
- Context extraction workflows
- Cross-platform compatibility

### E2E Tests
- Full user workflows
- Keyboard shortcut functionality
- Extension popup interactions
- Content script communication

## Common Development Tasks

### Adding New Platform Support
1. Create adapter in `src/adapters/platforms/`
2. Implement `PlatformAdapter` interface
3. Add platform detection logic
4. Write comprehensive tests
5. Update documentation

### Debugging Extension Issues
1. Check `chrome://extensions/` for errors
2. Use Chrome DevTools for popup debugging
3. Check console in content script context
4. Verify manifest permissions
5. Test in incognito mode

### Performance Optimization
- Use Chrome DevTools Performance tab
- Monitor memory usage in Task Manager
- Profile extension startup time
- Optimize DOM queries in content scripts

## Build and Deployment

### Development Build
```bash
npm run dev  # Builds to dist/ with source maps
```

### Production Build  
```bash
npm run build  # Optimized build for Chrome Web Store
```

### Loading in Chrome
1. Navigate to `chrome://extensions/`
2. Enable "Developer mode"
3. Click "Load unpacked"
4. Select the `dist/` directory

## Error Handling Patterns

Use the custom `FAFError` class for consistent error handling:

```typescript
import { FAFError, FAFErrorCode } from '@/core/errors';

throw new FAFError(
  FAFErrorCode.PLATFORM_NOT_SUPPORTED,
  'GitHub private repositories require authentication',
  { context: { platform: 'github', url: window.location.href } }
);
```

## Code Style Guidelines

- **Variables/functions**: `camelCase`
- **Constants**: `UPPER_SNAKE_CASE`  
- **Classes/interfaces**: `PascalCase`
- **Files**: `kebab-case.ts` or `PascalCase.ts` for classes
- **No comments** unless explicitly requested
- **Prefer interfaces over types** for object shapes
- **Use explicit return types** for public methods

## Git Workflow

- Main branch: `main`
- Feature branches: `feature/description`
- Commit format: Conventional commits (`feat:`, `fix:`, `docs:`)
- All changes require tests and documentation updates

## Chrome Web Store Preparation

When ready for store submission:
1. Ensure all permissions are justified in manifest
2. Create promotional images and screenshots  
3. Write clear store description
4. Test on multiple Chrome versions
5. Verify privacy policy compliance

## VS Code Integration

Recommended extensions for development:
- Svelte for VS Code
- TypeScript Hero
- Chrome Debugger
- ESLint
- Prettier

## Troubleshooting

### Common Issues
1. **Extension not loading**: Check manifest.json syntax
2. **Content script not injecting**: Verify host permissions
3. **Popup not opening**: Check for console errors
4. **Platform detection failing**: Debug with browser DevTools
5. **Keyboard shortcuts not working**: Check for conflicts

### Debug Commands
```bash
# Check TypeScript errors
npx tsc --noEmit

# Validate manifest
chrome://extensions/ (Developer mode)

# Test in different environments  
npm run test -- --coverage
```

This context should provide Claude with comprehensive understanding of the FAF Chrome extension project structure, development practices, and technical requirements.