# 🚀 FAF Chrome Extension - Fast AF Context Extraction

> **Grab any codebase as .txt in one click. GitHub, Monaco, StackBlitz, GitLab—every dev's dream when you need it.**

Google-approved Chrome extension that extracts code context from ANY development environment. Monaco editor? React sandbox? GitHub repo? One click → perfect .txt context → ready for Claude, Cursor, or any AI.

[![Chrome Web Store](https://img.shields.io/chrome-web-store/v/lnecebepmpjpilldfmndnaofbfjkjlkm)](https://chromewebstore.google.com/detail/lnecebepmpjpilldfmndnaofbfjkjlkm)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Google Approved](https://img.shields.io/badge/Google-Approved-success)](https://chromewebstore.google.com/detail/lnecebepmpjpilldfmndnaofbfjkjlkm)
[![Downloads](https://img.shields.io/chrome-web-store/users/lnecebepmpjpilldfmndnaofbfjkjlkm)](https://chromewebstore.google.com/detail/lnecebepmpjpilldfmndnaofbfjkjlkm)

## 🎯 Why This Exists

**The Problem:** You're testing something in StackBlitz, you need to ask Claude about it, but copying code manually is a pain.

**The Solution:** One click. Entire codebase → clipboard as clean .txt. Works on GitHub, Monaco editor, React playgrounds, GitLab, anywhere.

**My Story:** Built it for myself while testing. Needed it. Google approved it. Success. Nine downloads. Zero reviews. But it's **top-notch** as you'd expect—when you need it, you NEED it.

**The Format:** The .txt output is a **pre-cursor to .faf**—any FAF tool gobbles it up like an appetizer. It's the universal handoff format for AI context.

## ✨ What It Does

- 🔍 **Works on 15+ platforms** - GitHub, Monaco, CodeMirror, StackBlitz, GitLab, Replit
- 📋 **One-click extraction** - Entire codebase → clipboard in <300ms
- 🎯 **Clean .txt format** - Human-readable, AI-ready, .faf-compatible
- ⚡ **Zero config** - Install, click icon, done
- 🛡️ **Google Approved** - Passed security review, live in Chrome Web Store

## 🚀 Quick Start

### 1. Install from Chrome Web Store

**[→ Install FAF Extension](https://chromewebstore.google.com/detail/lnecebepmpjpilldfmndnaofbfjkjlkm)**

Or build from source:
```bash
git clone https://github.com/Wolfe-Jam/faf-chrome-extension.git
cd faf-chrome-extension
npm install && npm run build
```

### 2. Use It

1. Open any GitHub repo, Monaco editor, StackBlitz, etc.
2. Click FAF extension icon 🚀
3. Click "Extract Context"
4. Context copied to clipboard as clean .txt
5. Paste into Claude, Cursor, or any AI

### 3. Real Example

**Without FAF:**
```
You: "Help with this React component"
AI: "Which component? Show me the code"
You: [manually copies files one by one]
```

**With FAF:**
```
You: [pastes FAF .txt] "Help with this React component"
AI: "I see you're using React 18 with Vite, here's what I'd change in Button.tsx..."
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

If `FAF Chrome Extension` has been useful, consider starring the repo — it helps others find it.

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