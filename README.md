# 🚀 FAF - Fast AF AI Context Extraction

> **Extract perfect AI context in 0.3 seconds. Stop FAFfing About.**

FAF is a lightning-fast Chrome extension and emerging open standard for AI context extraction. It intelligently analyzes codebases, documentation, and development environments to generate structured `.faf` files that provide AI assistants with the perfect context for your project.

[![Version](https://img.shields.io/badge/version-1.0.1-blue.svg)](https://github.com/Wolfe-Jam/faf-production)
[![License](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)
[![Chrome Extension](https://img.shields.io/badge/chrome-extension-orange.svg)](https://chrome.google.com/webstore)

## ✨ What is FAF?

FAF (**F**ast **A**F) solves the universal problem every developer faces: **providing AI assistants with the right context**. Instead of manually copying and pasting code snippets, file structures, and project details, FAF:

- 🔍 **Intelligently analyzes** your codebase across 15+ platforms (GitHub, Monaco, CodeMirror, etc.)
- 📊 **Scores context quality** from 0-100% based on completeness and relevance  
- 📋 **Copies structured context** directly to your clipboard in seconds
- 🎯 **Works everywhere** - any website, any development environment
- ⚡ **Blazing fast** - Full extraction in under 300ms

## 🎯 Quick Start

### 1. Install the Chrome Extension

```bash
# Clone and build locally (Chrome Web Store submission pending)
git clone https://github.com/Wolfe-Jam/faf-production.git
cd faf-production
npm install
npm run build
```

Then load `dist/` as an unpacked extension in Chrome.

### 2. Extract Context Instantly

1. **Navigate** to any GitHub repo, CodeSandbox, or development site
2. **Click** the FAF extension icon ⚡
3. **Hit** "Extract AI Context" 
4. **Paste** the perfect context into ChatGPT, Claude, or any AI assistant

### 3. Get Better AI Responses

```
🤖 Instead of: "Help me with my React app"
✅ With FAF: [Pastes comprehensive .faf context with file structure, dependencies, platform details]

Result: AI instantly understands your project structure, tech stack, and current context.
```

## 📋 Supported Platforms

FAF works intelligently across all major development environments:

| Platform | Support Level | Features |
|----------|---------------|----------|
| **GitHub** | 🟢 Full | File trees, README detection, dependency analysis |
| **Monaco Editor** | 🟢 Full | Multi-file extraction, language detection |
| **CodeSandbox** | 🟢 Full | Project structure, live file content |
| **StackBlitz** | 🟢 Full | WebContainer integration, real-time analysis |
| **CodeMirror** | 🟡 Partial | Code block extraction, basic structure |
| **VS Code Web** | 🟡 Partial | File content, workspace detection |
| **Generic Sites** | 🟡 Basic | Code block identification, language detection |

## 📊 The .faf Format

FAF generates structured JSON files with comprehensive project context:

```json
{
  "version": "1.0.0",
  "generated": "2025-01-23T10:30:00Z",
  "score": 87,
  "context": {
    "platform": "github",
    "structure": {
      "files": [...],
      "directories": [...],
      "entryPoints": ["index.js", "package.json"]
    },
    "dependencies": {
      "runtime": {"language": "JavaScript", "packageManager": "npm"},
      "packages": [...]
    },
    "environment": {
      "variables": [...],
      "configFiles": [...]
    }
  }
}
```

## 🏗️ Architecture

FAF is built with modern web technologies for maximum performance:

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Popup UI      │    │  Content Script │    │ Service Worker  │
│   (Svelte 5)    │◄──►│  (Platform      │◄──►│   (Background   │
│                 │    │   Detection)    │    │    Telemetry)   │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         └───────────────────────┼───────────────────────┘
                                 ▼
                    ┌─────────────────────────┐
                    │    FAF Engine Core      │
                    │  • Platform Detection  │
                    │  • Context Extraction  │
                    │  • Quality Scoring     │
                    │  • Error Recovery      │
                    └─────────────────────────┘
```

## 🚀 Development

### Prerequisites

- Node.js 18+
- Chrome/Chromium browser
- npm or pnpm

### Setup

```bash
# Clone the repository
git clone https://github.com/Wolfe-Jam/faf-production.git
cd faf-production

# Install dependencies
npm install

# Start development mode
npm run dev

# Build for production
npm run build

# Run tests
npm test

# Lint and format
npm run lint
npm run format
```

### Project Structure

```
faf-production/
├── src/
│   ├── core/           # Core FAF engine and algorithms
│   ├── adapters/       # Platform-specific adapters
│   ├── ui/             # Popup and content script UI
│   └── background/     # Service worker and background tasks
├── public/             # Extension manifest and assets
├── tests/              # Test suites
└── dist/               # Built extension files
```

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for details.

### Quick Contribution Steps

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Make your changes and add tests
4. Run the test suite: `npm test`
5. Commit with a clear message: `git commit -m 'Add amazing feature'`
6. Push to your fork: `git push origin feature/amazing-feature`
7. Open a Pull Request

## 📈 Performance

FAF is engineered for speed:

- **⚡ < 300ms** average extraction time
- **🎯 95%+** accuracy on supported platforms  
- **📦 < 70KB** extension size
- **🔄 < 5MB** memory usage
- **⚖️ 0** network requests (works offline)

## 🛡️ Security & Privacy

- **🔐 No data collection** - Everything runs locally
- **🚫 No network requests** - Complete offline operation  
- **🔒 No storage** of sensitive information
- **✅ Open source** - Fully auditable code
- **🛡️ CSP compliant** - Works on security-focused sites

## 🗺️ Roadmap

### v1.1 - Enhanced Platform Support
- [ ] Replit integration
- [ ] Gitpod support  
- [ ] CodeSpaces compatibility

### v1.2 - CLI Tool
- [ ] Standalone command-line interface
- [ ] GitHub Actions integration
- [ ] CI/CD pipeline support

### v2.0 - The .faf Standard
- [ ] Official specification release
- [ ] Multi-language implementations
- [ ] IDE plugin ecosystem

## 📜 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- Built with [Svelte 5](https://svelte.dev/) and modern web APIs
- Inspired by the need for better AI context in development workflows
- Powered by the developer community's feedback and contributions

## 📞 Support

- 🐛 **Bug Reports**: [GitHub Issues](https://github.com/Wolfe-Jam/faf-production/issues)
- 💡 **Feature Requests**: [GitHub Discussions](https://github.com/Wolfe-Jam/faf-production/discussions)  
- 💬 **Community**: [Discord Server](https://discord.gg/faf-dev) (coming soon)
- 📧 **Contact**: [hello@faf.dev](mailto:hello@faf.dev)

---

<div align="center">

**[Install Extension](https://chrome.google.com/webstore) • [View Docs](https://docs.faf.dev) • [Join Community](https://discord.gg/faf-dev)**

Made with ⚡ by developers, for developers.

</div>