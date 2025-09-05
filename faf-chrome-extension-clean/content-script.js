// 🏎️⚡️ FAF Extension - Content Script with Wappalyzer-style Analysis

console.log('🏎️ FAF content script loading...');

// Load analyzer and patterns
const script1 = document.createElement('script');
script1.src = chrome.runtime.getURL('patterns.js');
document.head.appendChild(script1);

const script2 = document.createElement('script');
script2.src = chrome.runtime.getURL('analyzer.js');
document.head.appendChild(script2);

// Wait for scripts to load then initialize
setTimeout(() => {
  console.log('🏎️ FAF content script ready with Wappalyzer-style detection');
}, 100);

// Listen for messages from popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'analyze') {
    console.log('🔍 Starting Wappalyzer-style analysis...');
    
    const analysis = performWappalyzerAnalysis();
    console.log('✅ Analysis complete:', analysis);
    
    sendResponse(analysis);
  }
  return true; // Keep message channel open for async response
});

function performWappalyzerAnalysis() {
  try {
    // Use the Wappalyzer-style analyzer
    const analyzer = new window.FAFAnalyzer();
    const result = analyzer.analyze();
    
    return {
      platform: result.platform,
      score: result.score,
      details: result.details,
      confidence: result.confidence,
      url: window.location.href,
      timestamp: new Date().toISOString(),
      method: 'Wappalyzer-style Detection'
    };
  } catch (error) {
    console.error('❌ Analyzer failed, falling back to simple detection:', error);
    return performFallbackAnalysis();
  }
}

// Fallback to simple analysis if Wappalyzer-style fails
function performFallbackAnalysis() {
  const url = window.location.href;
  let platform = 'Unknown';
  let score = 30;
  let details = ['⚠️ Using fallback detection'];
  
  // Simple URL-based detection
  if (url.includes('github.com')) {
    platform = 'GitHub';
    score = 70;
    details.push('🐙 GitHub repository detected');
  } else if (url.includes('codesandbox')) {
    platform = 'CodeSandbox';
    score = 75;
    details.push('🏖️ CodeSandbox environment');
  } else if (url.includes('stackblitz')) {
    platform = 'StackBlitz';
    score = 75;
    details.push('⚡️ StackBlitz environment');
  } else if (document.querySelector('.monaco-editor')) {
    platform = 'Monaco Editor';
    score = 85;
    details.push('⚡️ Monaco editor detected');
  }
  
  return {
    platform,
    score,
    details,
    confidence: 'Low',
    url,
    timestamp: new Date().toISOString(),
    method: 'Fallback Detection'
  };
}

// Keep original analysis functions for reference
function analyzeGitHub() {
  const details = [];
  let score = 60; // Base score
  
  // Check if it's a repository page
  if (document.querySelector('.repository-content')) {
    score += 20;
    details.push('✅ Repository page detected');
    
    // Check for README
    if (document.querySelector('article[data-path="README.md"]') || 
        document.querySelector('readme-toc')) {
      score += 10;
      details.push('📚 README.md found');
    }
    
    // Check for package.json (Node.js project)
    if (document.querySelector('a[title="package.json"]')) {
      score += 15;
      details.push('📦 Node.js project detected');
    }
    
    // Check for source code files
    const codeFiles = document.querySelectorAll('a[href*=".js"], a[href*=".ts"], a[href*=".py"], a[href*=".java"]');
    if (codeFiles.length > 0) {
      score += 10;
      details.push(`💻 ${codeFiles.length} code files detected`);
    }
  } else {
    details.push('⚠️ Not a repository page');
  }
  
  return { score: Math.min(score, 95), details };
}

// CodeSandbox analysis
function analyzeCodeSandbox() {
  const details = [];
  let score = 70; // Base score for CodeSandbox
  
  // Check for file explorer
  if (document.querySelector('[data-testid="file-explorer"]') || 
      document.querySelector('.file-tree')) {
    score += 15;
    details.push('📁 File explorer accessible');
  }
  
  // Check for code editor
  if (document.querySelector('.monaco-editor') || 
      document.querySelector('.CodeMirror')) {
    score += 20;
    details.push('⚡️ Code editor detected');
  }
  
  // Check for terminal/console
  if (document.querySelector('[data-testid="terminal"]') ||
      document.querySelector('.xterm')) {
    score += 10;
    details.push('💻 Terminal access available');
  }
  
  details.push('🏖️ CodeSandbox project environment');
  
  return { score: Math.min(score, 98), details };
}

// StackBlitz analysis
function analyzeStackBlitz() {
  const details = [];
  let score = 75; // Base score for StackBlitz
  
  // Check for project structure
  if (document.querySelector('.file-tree') || 
      document.querySelector('[data-test="file-tree"]')) {
    score += 15;
    details.push('🌳 Project tree accessible');
  }
  
  // Check for Monaco editor
  if (document.querySelector('.monaco-editor')) {
    score += 15;
    details.push('⚡️ Monaco editor integration');
  }
  
  details.push('⚡️ StackBlitz WebContainer environment');
  
  return { score: Math.min(score, 96), details };
}

// Monaco Editor detection and analysis
function isMonacoEditor() {
  return !!document.querySelector('.monaco-editor');
}

function analyzeMonaco() {
  const details = [];
  let score = 85; // High base score for Monaco
  
  const monacoElements = document.querySelectorAll('.monaco-editor');
  if (monacoElements.length > 0) {
    score += 10;
    details.push(`⚡️ ${monacoElements.length} Monaco editor instances`);
    
    // Try to detect if there are multiple files/tabs
    const tabs = document.querySelectorAll('.tab, .monaco-tab, [role="tab"]');
    if (tabs.length > 1) {
      score += 5;
      details.push(`📄 ${tabs.length} files/tabs detected`);
    }
  }
  
  details.push('🎯 Direct code editor access');
  details.push('💡 Real-time code analysis possible');
  
  return { score: Math.min(score, 100), details };
}

// Generic website analysis
function analyzeGeneric() {
  const details = [];
  let score = 25; // Low base score
  let platform = 'Generic Website';
  
  // Check for code blocks
  const codeBlocks = document.querySelectorAll('pre code, .highlight, .codehilite, .language-');
  if (codeBlocks.length > 0) {
    score += 20;
    details.push(`💻 ${codeBlocks.length} code blocks found`);
    platform = 'Documentation/Blog';
  }
  
  // Check for documentation patterns
  if (document.title.toLowerCase().includes('docs') || 
      document.querySelector('.documentation, .docs')) {
    score += 15;
    details.push('📖 Documentation site detected');
    platform = 'Documentation Site';
  }
  
  // Check for API references
  if (document.querySelector('.api-reference, .reference, .endpoint')) {
    score += 10;
    details.push('🔗 API documentation detected');
  }
  
  details.push('🌐 Generic web content');
  details.push('⚠️ Limited context extraction capability');
  
  return { platform, score: Math.min(score, 65), details };
}

console.log('⚡️ FAF content script ready');