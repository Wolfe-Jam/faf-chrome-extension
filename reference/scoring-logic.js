/**
 * FAF Scoring Logic - Reference Implementation
 * Extract this logic into strict TypeScript for production
 */

// Brand Colors (EXACT - Non-negotiable)
const BRAND_COLORS = {
  orange: '#FF6B35',
  cream: '#FFF8F0', 
  cyan: '#5CE1E6',
  black: '#0A0A0A'
};

// Badge Color Rules
const BADGE_COLORS = {
  high: { bg: '#FF6B35', text: '#FFF8F0' },    // 80-100%
  medium: { bg: '#5CE1E6', text: '#0A0A0A' },  // 50-79%
  low: { bg: '#0A0A0A', text: '#FF6B35' }      // 0-49%
};

// Platform Detection & Base Scores
function detectPlatform() {
  const hostname = window.location.hostname;
  const pathname = window.location.pathname;
  
  // Monaco Editor - 100%
  if ('monaco' in window) {
    return { platform: 'monaco', baseScore: 100 };
  }
  
  // GitHub - Base 75%
  if (hostname.includes('github.com') && pathname.includes('/')) {
    return { platform: 'github', baseScore: 75 };
  }
  
  // CodeMirror - 85%  
  if ('CodeMirror' in window) {
    return { platform: 'codemirror', baseScore: 85 };
  }
  
  // VS Code Web
  if (hostname.includes('vscode.dev')) {
    return { platform: 'vscode-web', baseScore: 90 };
  }
  
  // StackBlitz
  if (hostname.includes('stackblitz.com')) {
    return { platform: 'stackblitz', baseScore: 95 };
  }
  
  // Regular pages - 25%
  return { platform: 'unknown', baseScore: 25 };
}

// Score Calculation
function calculateScore() {
  const detection = detectPlatform();
  let score = detection.baseScore;
  
  // Bonuses for GitHub
  if (detection.platform === 'github') {
    if (hasPackageJson()) score += 10;
    if (hasEnvFile()) score += 5;
    if (hasReadme()) score += 5;
    if (hasDockerfile()) score += 5;
  }
  
  // Bonuses for code blocks on any page
  const codeBlocks = document.querySelectorAll('pre, code, .highlight').length;
  if (codeBlocks > 0) {
    score += Math.min(20, codeBlocks * 2);
  }
  
  return Math.min(100, Math.max(0, score));
}

// Helper functions
function hasPackageJson() {
  return document.querySelector('a[href*="package.json"]') !== null;
}

function hasEnvFile() {
  return document.querySelector('a[href*=".env"]') !== null;
}

function hasReadme() {
  return document.querySelector('a[href*="README"]') !== null;
}

function hasDockerfile() {
  return document.querySelector('a[href*="Dockerfile"]') !== null;
}

// .faf Format Generation
function generateFafContent(score, platform, url) {
  const timestamp = new Date().toISOString();
  
  return `.faf Context
URL: ${url}
Platform: ${platform}
Score: ${score}%
Extracted: ${timestamp}

Detection
Code blocks found: ${document.querySelectorAll('pre, code, .highlight').length}
Package.json detected: ${hasPackageJson()}
Environment vars: ${hasEnvFile()}

AI Instructions
Context extracted from ${platform} with ${score}% confidence.
${getConfidenceMessage(score)}`;
}

function getConfidenceMessage(score) {
  if (score >= 80) return 'High confidence - Full project context available.';
  if (score >= 50) return 'Medium confidence - Partial context available.';
  return 'Low confidence - Limited context available.';
}

// Export for reference
if (typeof module !== 'undefined') {
  module.exports = {
    BRAND_COLORS,
    BADGE_COLORS,
    detectPlatform,
    calculateScore,
    generateFafContent
  };
}