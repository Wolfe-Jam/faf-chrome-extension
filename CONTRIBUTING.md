# Contributing to FAF

First off, thank you for considering contributing to FAF! 🎉 

FAF is built by the community, for the community. Whether you're fixing a bug, adding a new platform integration, improving documentation, or proposing a new feature, your contributions are welcome.

## 📋 Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Setup](#development-setup)
- [Project Structure](#project-structure)
- [How to Contribute](#how-to-contribute)
- [Coding Standards](#coding-standards)
- [Testing Guidelines](#testing-guidelines)
- [Pull Request Process](#pull-request-process)
- [Release Process](#release-process)

## 📖 Code of Conduct

This project and everyone participating in it is governed by our [Code of Conduct](CODE_OF_CONDUCT.md). By participating, you are expected to uphold this code. Please report unacceptable behavior to [conduct@faf.dev](mailto:conduct@faf.dev).

## 🚀 Getting Started

### Prerequisites

Before you begin, ensure you have the following installed:

- **Node.js 18+** ([Download](https://nodejs.org/))
- **npm or pnpm** (comes with Node.js)
- **Chrome/Chromium browser** for testing the extension
- **Git** for version control

### Development Setup

1. **Fork the repository** on GitHub
2. **Clone your fork** locally:
   ```bash
   git clone https://github.com/YOUR_USERNAME/faf-production.git
   cd faf-production
   ```
3. **Add the original repository** as upstream:
   ```bash
   git remote add upstream https://github.com/Wolfe-Jam/faf-production.git
   ```
4. **Install dependencies**:
   ```bash
   npm install
   ```
5. **Start development mode**:
   ```bash
   npm run dev
   ```
6. **Load the extension** in Chrome:
   - Navigate to `chrome://extensions/`
   - Enable "Developer mode"
   - Click "Load unpacked" and select the `dist/` directory

## 🏗️ Project Structure

Understanding the codebase structure will help you navigate and contribute effectively:

```
faf-production/
├── src/
│   ├── core/                 # Core FAF engine
│   │   ├── engine.ts        # Main extraction engine
│   │   ├── types.ts         # TypeScript type definitions
│   │   ├── errors.ts        # Error handling and recovery
│   │   ├── scoring.ts       # Context quality scoring
│   │   └── telemetry.ts     # Anonymous usage analytics
│   ├── adapters/            # Platform-specific integrations
│   │   ├── chrome.ts        # Chrome extension APIs
│   │   ├── clipboard.ts     # Clipboard operations
│   │   └── platforms/       # Platform detection and extraction
│   ├── ui/                  # User interface components
│   │   ├── popup.svelte     # Extension popup interface
│   │   └── content.ts       # Content script for page interaction
│   └── background/          # Service worker
├── public/                  # Extension assets
│   ├── manifest.json        # Chrome extension manifest
│   └── icons/              # Extension icons
├── tests/                   # Test suites
└── dist/                   # Built extension files (generated)
```

## 🤝 How to Contribute

### 🐛 Reporting Bugs

Found a bug? Please help us fix it:

1. **Check existing issues** first to avoid duplicates
2. **Use the bug report template** when creating a new issue
3. **Provide detailed steps to reproduce** the problem
4. **Include your environment details** (OS, Chrome version, etc.)

### 💡 Suggesting Features

Have an idea for a new feature?

1. **Check existing discussions** and issues first
2. **Use the feature request template** 
3. **Explain the use case** and why it would benefit users
4. **Be open to discussion** and alternative approaches

### 🔧 Code Contributions

Ready to write some code? Here are some great ways to contribute:

#### 🟢 Good First Issues

Look for issues labeled `good first issue` - these are specifically chosen to be approachable for new contributors.

#### 🔍 Platform Support

Add support for new development platforms:
- Create a new platform adapter in `src/adapters/platforms/`
- Implement the `PlatformAdapter` interface
- Add comprehensive tests for the new platform
- Update documentation

#### ⚡ Performance Improvements

Help make FAF even faster:
- Optimize extraction algorithms
- Reduce memory usage
- Improve startup time
- Add performance benchmarks

#### 🧪 Testing

Improve test coverage and quality:
- Add unit tests for new features
- Create integration tests for platform adapters
- Add end-to-end tests for the extension
- Test edge cases and error conditions

## 📏 Coding Standards

### TypeScript Guidelines

- **Use strict TypeScript** - No `any` types without explicit justification
- **Prefer interfaces over types** for object shapes
- **Use explicit return types** for public methods
- **Document complex functions** with JSDoc comments

```typescript
// ✅ Good
interface ExtractionResult {
  readonly success: boolean;
  readonly faf?: FAFContent;
  readonly error?: string;
}

async function extractContext(): Promise<ExtractionResult> {
  // Implementation
}

// ❌ Avoid
function extractContext(): any {
  // Implementation
}
```

### Code Style

We use ESLint and Prettier to enforce consistent code style:

```bash
# Check linting
npm run lint

# Auto-fix linting issues
npm run lint:fix

# Format code
npm run format
```

### Naming Conventions

- **Variables and functions**: `camelCase`
- **Constants**: `UPPER_SNAKE_CASE`
- **Classes and interfaces**: `PascalCase`
- **Files**: `kebab-case.ts` or `PascalCase.ts` for classes

### Error Handling

Use the custom `FAFError` class for consistent error handling:

```typescript
import { FAFError, FAFErrorCode } from '@/core/errors';

// ✅ Good
throw new FAFError(
  FAFErrorCode.PLATFORM_NOT_SUPPORTED,
  'GitHub private repositories require authentication',
  {
    context: { platform: 'github', url: window.location.href }
  }
);

// ❌ Avoid generic errors
throw new Error('Something went wrong');
```

## 🧪 Testing Guidelines

### Running Tests

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage
```

### Writing Tests

- **Unit tests**: Test individual functions and classes in isolation
- **Integration tests**: Test interactions between components
- **E2E tests**: Test the complete user workflow

Example test structure:

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { FAFEngine } from '@/core/engine';

describe('FAFEngine', () => {
  let engine: FAFEngine;

  beforeEach(() => {
    engine = new FAFEngine();
  });

  it('should extract context from GitHub repository', async () => {
    // Setup test environment
    // Act
    // Assert
  });
});
```

## 📥 Pull Request Process

### Before You Submit

1. **Create a feature branch** from `main`:
   ```bash
   git checkout -b feature/your-feature-name
   ```

2. **Make your changes** following the coding standards

3. **Add or update tests** for your changes

4. **Ensure all tests pass**:
   ```bash
   npm test
   ```

5. **Lint your code**:
   ```bash
   npm run lint
   ```

6. **Update documentation** if needed

### Pull Request Checklist

When you submit your PR, please ensure:

- [ ] **Clear title and description** explaining what and why
- [ ] **Tests added/updated** for new functionality
- [ ] **All tests are passing**
- [ ] **Code follows our style guidelines**
- [ ] **Documentation updated** if needed
- [ ] **No breaking changes** without discussion
- [ ] **Commit messages are descriptive**

### Commit Message Format

We use conventional commits for clear history:

```
type(scope): description

[optional body]

[optional footer]
```

Examples:
```
feat(platforms): add GitLab support
fix(clipboard): handle permission denied gracefully
docs(readme): update installation instructions
```

### Review Process

1. **Automated checks** will run on your PR
2. **Team members will review** your code
3. **Address feedback** if any changes are requested
4. **Once approved**, your PR will be merged

## 🚀 Release Process

Releases are handled by the maintainers:

1. **Version bump** using semantic versioning
2. **Changelog generation** from commit messages  
3. **Build and test** the release candidate
4. **Create GitHub release** with release notes
5. **Deploy to Chrome Web Store** (automated)

## 🏷️ Issue Labels

We use labels to organize and prioritize work:

- `good first issue` - Perfect for new contributors
- `bug` - Something isn't working correctly
- `enhancement` - New feature or improvement
- `documentation` - Documentation needs updating
- `platform` - Platform-specific integration work
- `performance` - Performance optimization
- `breaking-change` - Changes that break existing API

## 💬 Community & Support

- **GitHub Issues**: Bug reports and feature requests
- **GitHub Discussions**: General questions and ideas
- **Discord** (coming soon): Real-time community chat

## 🙏 Recognition

All contributors are recognized in our README and release notes. Your contributions, no matter how small, help make FAF better for everyone.

---

**Thank you for contributing to FAF!** 🚀

Together, we're building the future of AI context extraction.