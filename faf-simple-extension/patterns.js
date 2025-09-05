// 🏎️⚡️ FAF Extension - Wappalyzer-style Detection Patterns
// Platform fingerprints for coding environments

const FAF_PATTERNS = {
  "GitHub": {
    "score": 85,
    "url": "github\\.com",
    "dom": {
      "[data-testid='repository-container']": { "exists": "" },
      ".repository-content": { "exists": "" },
      "[data-pjax-container]": { "exists": "" }
    },
    "headers": {
      "server": "GitHub\\.com"
    },
    "js": [
      "github"
    ],
    "html": [
      "github\\.githubassets\\.com"
    ],
    "bonuses": {
      "[data-path='README.md']": { "score": 10, "message": "📚 README.md detected" },
      "a[title='package.json']": { "score": 15, "message": "📦 Node.js project" },
      ".file-navigation a[href*='.js']": { "score": 5, "message": "💻 JavaScript files" },
      ".file-navigation a[href*='.ts']": { "score": 8, "message": "⚡️ TypeScript files" },
      ".file-navigation a[href*='.py']": { "score": 5, "message": "🐍 Python files" },
      ".repository-lang-stats-graph": { "score": 10, "message": "📊 Language statistics" }
    }
  },

  "CodeSandbox": {
    "score": 90,
    "url": "codesandbox\\.io",
    "dom": {
      "[data-testid='file-explorer']": { "exists": "" },
      ".monaco-editor": { "exists": "" }
    },
    "js": [
      "codesandbox"
    ],
    "bonuses": {
      "[data-testid='terminal']": { "score": 10, "message": "💻 Terminal access" },
      ".file-tree": { "score": 15, "message": "📁 File tree available" },
      ".preview-container": { "score": 10, "message": "👁️ Live preview" }
    }
  },

  "StackBlitz": {
    "score": 88,
    "url": "stackblitz\\.com",
    "dom": {
      ".file-tree": { "exists": "" },
      ".monaco-editor": { "exists": "" }
    },
    "js": [
      "stackblitz"
    ],
    "bonuses": {
      "[data-test='file-tree']": { "score": 15, "message": "🌳 Project structure" },
      ".terminal": { "score": 10, "message": "💻 WebContainer terminal" },
      ".preview-frame": { "score": 10, "message": "⚡️ Instant preview" }
    }
  },

  "Monaco Editor": {
    "score": 95,
    "url": "",
    "dom": {
      ".monaco-editor": { "exists": "" },
      ".monaco-editor .view-lines": { "exists": "" }
    },
    "js": [
      "monaco"
    ],
    "bonuses": {
      ".monaco-editor[data-uri*='.ts']": { "score": 5, "message": "⚡️ TypeScript code" },
      ".monaco-editor[data-uri*='.js']": { "score": 3, "message": "💻 JavaScript code" },
      ".monaco-tab": { "score": 10, "message": "📄 Multiple files" }
    }
  },

  "Repl.it": {
    "score": 85,
    "url": "replit\\.com",
    "dom": {
      ".replit-ui": { "exists": "" },
      ".workspace": { "exists": "" }
    },
    "bonuses": {
      ".filetree": { "score": 15, "message": "📁 File browser" },
      ".console": { "score": 10, "message": "💻 Interactive console" }
    }
  },

  "Glitch": {
    "score": 80,
    "url": "glitch\\.com",
    "dom": {
      ".editor": { "exists": "" },
      ".project-options": { "exists": "" }
    },
    "bonuses": {
      ".file-tree": { "score": 15, "message": "📁 Project files" },
      ".terminal": { "score": 10, "message": "💻 Terminal available" }
    }
  },

  "CodePen": {
    "score": 75,
    "url": "codepen\\.io",
    "dom": {
      ".editor-parent": { "exists": "" },
      ".CodeMirror": { "exists": "" }
    },
    "bonuses": {
      ".result-iframe": { "score": 15, "message": "👁️ Live result" },
      ".editor-parent[data-type='html']": { "score": 5, "message": "📄 HTML editor" },
      ".editor-parent[data-type='css']": { "score": 5, "message": "🎨 CSS editor" },
      ".editor-parent[data-type='js']": { "score": 5, "message": "⚡️ JS editor" }
    }
  },

  "JSFiddle": {
    "score": 72,
    "url": "jsfiddle\\.net",
    "dom": {
      ".CodeMirror": { "exists": "" },
      "#fiddle": { "exists": "" }
    },
    "bonuses": {
      ".result": { "score": 15, "message": "👁️ Result pane" },
      ".CodeMirror-focused": { "score": 5, "message": "⚡️ Active editor" }
    }
  },

  "Observable": {
    "score": 78,
    "url": "observablehq\\.com",
    "dom": {
      ".notebook": { "exists": "" },
      ".cell": { "exists": "" }
    },
    "bonuses": {
      ".cell-input": { "score": 10, "message": "📝 Interactive cells" },
      ".cell-output": { "score": 10, "message": "📊 Live outputs" }
    }
  },

  "VS Code Online": {
    "score": 92,
    "url": "vscode\\.dev|github\\.dev",
    "dom": {
      ".monaco-workbench": { "exists": "" },
      ".explorer-viewlet": { "exists": "" }
    },
    "bonuses": {
      ".file-tree": { "score": 20, "message": "📁 Full file explorer" },
      ".monaco-editor": { "score": 15, "message": "⚡️ Full VS Code experience" }
    }
  },

  "Documentation Site": {
    "score": 45,
    "url": "",
    "dom": {
      ".documentation": { "exists": "" },
      ".docs": { "exists": "" },
      ".api-reference": { "exists": "" }
    },
    "html": [
      "gitbook",
      "docsify",
      "vuepress",
      "docusaurus"
    ],
    "bonuses": {
      "pre code": { "score": 15, "message": "💻 Code examples" },
      ".highlight": { "score": 10, "message": "🎨 Syntax highlighting" },
      ".language-": { "score": 8, "message": "📝 Multiple languages" }
    }
  },

  "Generic Website": {
    "score": 25,
    "url": "",
    "bonuses": {
      "pre code": { "score": 10, "message": "💻 Code blocks found" },
      ".highlight, .codehilite": { "score": 8, "message": "🎨 Code highlighting" }
    }
  }
};

// Export for use in content script
if (typeof module !== 'undefined' && module.exports) {
  module.exports = FAF_PATTERNS;
} else if (typeof window !== 'undefined') {
  window.FAF_PATTERNS = FAF_PATTERNS;
}