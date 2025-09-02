/**
 * Platform Detection and Context Extraction
 * Type-safe platform-specific logic
 */

import type { FileInfo, Platform, CodeContext } from '@/core/types';
import { createScore as makeScore } from '@/core/types';
import { FAFError, FAFErrorCode } from '@/core/errors';
import { withErrorBoundary } from '@/core/errors';

export interface WindowWithEditors extends Window {
  monaco?: {
    editor: {
      getModels(): Array<{
        uri: { toString(): string };
        getLanguageId(): string;
        getValue(): string;
      }>;
    };
  };
  CodeMirror?: {
    instances?: Array<{
      getValue(): string;
      getMode(): { name?: string };
    }>;
  };
}

declare const window: WindowWithEditors;

interface ExtractedData {
  files: FileInfo[];
  confidence: number;
  metadata: Record<string, any>;
}

/**
 * Universal Platform detector with unified async detection, intelligent caching, and race condition prevention
 * Handles GitHub DOM, Monaco global, CodeMirror instances, VSCode markers, StackBlitz signatures
 */
export class PlatformDetector {
  private readonly hostname: string;
  private readonly pathname: string;
  private readonly maxTimeout = 100; // 100ms timeout for DOM operations

  // Cache management
  private cachedResult: {
    platform: Platform;
    timestamp: number;
    confidence: number;
  } | undefined = undefined;
  
  // Race condition prevention  
  private activeDetection: Promise<Platform> | undefined = undefined;
  
  // Cache validity (5 seconds for page navigation detection)
  private readonly CACHE_TTL = 5000;

  constructor() {
    this.hostname = window.location.hostname;
    this.pathname = window.location.pathname;
    
    // Invalidate cache on navigation
    this.setupNavigationListeners();
  }

  /**
   * Single unified detection method - ALWAYS async
   * Prevents race conditions and provides intelligent caching
   */
  async detect(): Promise<Platform> {
    // 1. If detection already in progress, return same promise (no races)
    if (this.activeDetection) {
      return this.activeDetection;
    }
    
    // 2. If cache is fresh, return immediately (fast path)
    if (this.isCacheFresh()) {
      return Promise.resolve(this.cachedResult!.platform);
    }
    
    // 3. Start new detection with lock to prevent concurrent calls
    this.activeDetection = this.performDetection()
      .then(platform => {
        this.cacheResult(platform);
        return platform;
      })
      .finally(() => {
        // Clear lock when done (success or failure)
        this.activeDetection = undefined;
      });
    
    return this.activeDetection;
  }

  /**
   * Invalidate cache (useful for navigation events)
   */
  invalidateCache(): void {
    this.cachedResult = undefined;
    // Don't clear activeDetection - let it finish naturally
  }

  /**
   * Get cached platform without triggering detection
   */
  getCached(): Platform | null {
    return this.isCacheFresh() ? this.cachedResult!.platform : null;
  }

  private isCacheFresh(): boolean {
    if (!this.cachedResult) return false;
    const age = Date.now() - this.cachedResult.timestamp;
    return age < this.CACHE_TTL;
  }

  private cacheResult(platform: Platform): void {
    this.cachedResult = {
      platform,
      timestamp: Date.now(),
      confidence: this.calculateConfidence(platform)
    };
  }

  private calculateConfidence(platform: Platform): number {
    // High confidence for exact matches
    if (platform === 'github' && this.hostname.includes('github.com')) return 95;
    if (platform === 'gitlab' && this.hostname.includes('gitlab')) return 95;
    if (platform === 'monaco' && window.monaco) return 90;
    if (platform === 'stackblitz' && this.hostname.includes('stackblitz')) return 90;
    
    // Medium confidence for DOM-based detection
    if (platform !== 'unknown' && platform !== 'has-code') return 75;
    
    // Low confidence fallbacks
    return 50;
  }

  private setupNavigationListeners(): void {
    // Invalidate cache on navigation events
    if (typeof window !== 'undefined') {
      window.addEventListener('popstate', () => this.invalidateCache());
      window.addEventListener('pushstate', () => this.invalidateCache());
      window.addEventListener('replacestate', () => this.invalidateCache());
    }
  }

  private async performDetection(): Promise<Platform> {
    performance.mark('platform-detection-start');
    
    try {
      // Fast checks first (5-10ms) - URL and global checks
      const fastResult = this.detectFastPath();
      if (fastResult !== 'unknown') {
        return fastResult;
      }

      // DOM-based detection with timeout (50ms max)
      const domResult = await this.detectWithTimeout(this.maxTimeout);
      if (domResult !== 'unknown') {
        return domResult;
      }

      // Final fallback - user agent detection
      return this.detectFromUserAgent();
      
    } catch (error) {
      // Convert to standardized FAF error
      if (error instanceof Error && error.message.includes('timeout')) {
        throw new FAFError(FAFErrorCode.PLATFORM_DETECTION_TIMEOUT, 'Platform detection timed out', {
          cause: error,
          context: { 
            platform: 'unknown',
            url: window.location.href,
            timestamp: Date.now()
          }
        });
      }

      if (error instanceof Error && error.message.includes('DOM')) {
        throw new FAFError(FAFErrorCode.PLATFORM_DOM_ACCESS_DENIED, 'Cannot access page DOM', {
          cause: error,
          context: { 
            platform: 'unknown',
            url: window.location.href,
            timestamp: Date.now()
          }
        });
      }

      // Re-throw FAF errors as-is
      if (error instanceof FAFError) {
        throw error;
      }

      // Wrap unknown errors
      throw new FAFError(FAFErrorCode.PLATFORM_DETECTION_FAILED, 'Platform detection failed', {
        cause: error instanceof Error ? error : new Error(String(error)),
        context: { 
          platform: 'unknown',
          url: window.location.href,
          timestamp: Date.now()
        }
      });
      
    } finally {
      performance.mark('platform-detection-end');
      performance.measure('platform-detection', 'platform-detection-start', 'platform-detection-end');
    }
  }

  /**
   * @deprecated Use detect() instead. Kept for backward compatibility during transition.
   */
  async detectPlatformAsync(): Promise<Platform> {
    return this.detect();
  }


  /**
   * Extract complete context with platform-specific strategies
   */
  async extractContextAsync(): Promise<CodeContext> {
    performance.mark('context-extraction-start');
    
    try {
      const platform = await this.detect();
      
      let extractedData;
      
      switch (platform) {
        case 'monaco':
          extractedData = await this.extractMonacoContext();
          break;
        case 'github':
          extractedData = await this.extractGitHubContext();
          break;
        case 'codemirror':
          extractedData = await this.extractCodeMirrorContext();
          break;
        case 'stackblitz':
          extractedData = await this.extractStackBlitzContext();
          break;
        case 'codesandbox':
          extractedData = await this.extractCodeSandboxContext();
          break;
        case 'localhost':
          extractedData = await this.extractLocalhostContext();
          break;
        default:
          extractedData = await this.extractGenericContext();
      }

      performance.mark('context-extraction-end');
      performance.measure('context-extraction', 'context-extraction-start', 'context-extraction-end');

      return this.buildCodeContext(platform, extractedData);
    } catch (error) {
      console.warn('Context extraction failed:', error);
      performance.mark('context-extraction-end');
      performance.measure('context-extraction', 'context-extraction-start', 'context-extraction-end');
      
      // Return fallback context
      return this.buildFallbackContext();
    }
  }

  /**
   * Fast synchronous detection using window globals
   */
  private detectFastPath(): Platform {
    // Monaco detection - highest priority (VS Code Web, StackBlitz often use Monaco)
    if (this.isMonacoAvailable()) return 'monaco';
    
    // URL-based detection (immediate)
    if (this.hostname.includes('github.com')) return 'github';
    if (this.hostname.includes('gitlab.com')) return 'gitlab';
    if (this.hostname.includes('stackblitz.com')) return 'stackblitz';
    if (this.hostname.includes('codesandbox.io')) return 'codesandbox';
    if (this.hostname.includes('codepen.io')) return 'codepen';
    if (this.hostname.includes('vscode.dev')) return 'vscode-web';
    if (this.hostname.includes('github.dev')) return 'vscode-web';
    if (this.isLocalhost()) return 'localhost';
    
    // CodeMirror detection
    if (this.isCodeMirrorAvailable()) return 'codemirror';
    
    return 'unknown';
  }

  /**
   * Async detection with timeout protection
   */
  private async detectWithTimeout(timeoutMs: number = this.maxTimeout): Promise<Platform> {
    return new Promise((resolve) => {
      const timeout = setTimeout(() => {
        resolve('unknown');
      }, timeoutMs);

      this.performAsyncDetection()
        .then((result) => {
          clearTimeout(timeout);
          resolve(result);
        })
        .catch(() => {
          clearTimeout(timeout);
          resolve('unknown');
        });
    });
  }

  /**
   * Async detection strategies for DOM-dependent platforms
   */
  private async performAsyncDetection(): Promise<Platform> {
    // Wait for DOM to be ready
    await this.waitForDOM();
    
    // Check for code elements in DOM
    if (this.hasSignificantCodeElements()) {
      return 'has-code';
    }
    
    return 'unknown';
  }

  /**
   * Platform-specific detection helpers
   */
  private isMonacoAvailable(): boolean {
    try {
      return 'monaco' in window && window.monaco != null && typeof window.monaco.editor !== 'undefined';
    } catch {
      return false;
    }
  }

  private isCodeMirrorAvailable(): boolean {
    try {
      return 'CodeMirror' in window && window.CodeMirror != null;
    } catch {
      return false;
    }
  }

  private isLocalhost(): boolean {
    return this.hostname === 'localhost' || this.hostname === '127.0.0.1' || this.hostname.includes('localhost');
  }

  private hasSignificantCodeElements(): boolean {
    try {
      const codeSelectors = [
        'pre code',
        '.highlight',
        '.hljs',
        '[class*="language-"]',
        '[class*="lang-"]',
        '.code-block'
      ];
      
      let totalCodeElements = 0;
      for (const selector of codeSelectors) {
        totalCodeElements += document.querySelectorAll(selector).length;
        if (totalCodeElements >= 3) return true; // Threshold for "significant"
      }
      
      return false;
    } catch {
      return false;
    }
  }

  private async waitForDOM(): Promise<void> {
    return new Promise((resolve) => {
      if (document.readyState === 'complete' || document.readyState === 'interactive') {
        resolve();
      } else {
        document.addEventListener('DOMContentLoaded', () => resolve(), { once: true });
      }
    });
  }

  /**
   * URL-based platform detection (fallback strategy)
   */
  private detectFromURL(): Platform {
    try {
      const hostname = window.location.hostname.toLowerCase();
      const pathname = window.location.pathname.toLowerCase();

      // GitHub detection
      if (hostname.includes('github.com') || hostname.includes('github.io')) {
        return 'github';
      }

      // GitLab detection
      if (hostname.includes('gitlab.com') || hostname.includes('gitlab.io')) {
        return 'gitlab';
      }

      // StackBlitz detection
      if (hostname.includes('stackblitz.com') || hostname.includes('stackblitz.io')) {
        return 'stackblitz';
      }

      // CodeSandbox detection
      if (hostname.includes('codesandbox.io') || hostname.includes('csb.app')) {
        return 'codesandbox';
      }

      // CodePen detection
      if (hostname.includes('codepen.io') || hostname.includes('codepen.com')) {
        return 'codepen';
      }

      // VS Code Web detection
      if (hostname.includes('vscode.dev') || pathname.includes('vscode')) {
        return 'vscode-web';
      }

      // Localhost detection
      if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname.startsWith('192.168.')) {
        return 'localhost';
      }

      // Check for common dev server ports
      const port = window.location.port;
      const devPorts = ['3000', '3001', '4200', '5173', '8000', '8080', '9000'];
      if (port && devPorts.includes(port)) {
        return 'localhost';
      }

    } catch (error) {
      console.warn('URL-based detection failed:', error);
    }

    return 'unknown';
  }

  /**
   * User agent-based detection (last resort)
   */
  private detectFromUserAgent(): Platform {
    try {
      const userAgent = navigator.userAgent.toLowerCase();

      // VS Code Web user agent patterns
      if (userAgent.includes('vscode')) {
        return 'vscode-web';
      }

      // Check for embedded browser indicators
      if (userAgent.includes('electron')) {
        // Could be VS Code or another Electron app
        return 'vscode-web';
      }

      // Check for specific browser features that might indicate a platform
      if (typeof (window as any).acquireVsCodeApi === 'function') {
        return 'vscode-web';
      }

    } catch (error) {
      console.warn('User agent detection failed:', error);
    }

    return 'unknown';
  }

  /**
   * Circuit breaker pattern for detection failures
   */
  private readonly circuitBreaker = {
    failures: 0,
    maxFailures: 5,
    resetTimeout: 60000, // 1 minute
    lastFailureTime: 0,

    isOpen(): boolean {
      const now = Date.now();
      if (this.failures >= this.maxFailures) {
        if (now - this.lastFailureTime > this.resetTimeout) {
          // Reset the circuit breaker
          this.failures = 0;
          return false;
        }
        return true;
      }
      return false;
    },

    recordFailure(): void {
      this.failures++;
      this.lastFailureTime = Date.now();
    },

    recordSuccess(): void {
      this.failures = 0;
    }
  };

  /**
   * Enhanced detection with circuit breaker protection
   */
  private async __detectWithCircuitBreaker(): Promise<Platform> {
    // Check if circuit breaker is open
    if (this.circuitBreaker.isOpen()) {
      console.warn('🚫 Platform detection circuit breaker is open - using fallback');
      return this.detectFromURL() || 'unknown';
    }

    try {
      const result = await this.detect();
      this.circuitBreaker.recordSuccess();
      return result;
    } catch (error) {
      this.circuitBreaker.recordFailure();
      console.error('Platform detection failed, circuit breaker triggered:', error);
      return 'unknown';
    }
  }

  /**
   * Platform-specific context extractors with full error handling
   */
  private async extractMonacoContext(): Promise<ExtractedData> {
    try {
      if (!window.monaco?.editor) {
        throw new Error('Monaco editor not available');
      }

      const models = window.monaco.editor.getModels();
      const files: FileInfo[] = models.map((model): FileInfo => {
        const uri = model.uri.toString();
        const content = model.getValue();
        
        return {
          path: uri.replace(/^file:\/\/\//, ''),
          language: model.getLanguageId(),
          content,
          lines: content.split('\n').length,
          size: content.length
        };
      });

      return {
        files,
        confidence: 100,
        metadata: {
          editorType: 'monaco',
          modelCount: models.length,
          totalSize: files.reduce((sum, f) => sum + f.size, 0)
        }
      };
    } catch (error) {
      console.warn('Monaco context extraction failed:', error);
      return this.getFallbackExtractedData();
    }
  }

  private async extractGitHubContext(): Promise<ExtractedData> {
    try {
      const files: FileInfo[] = [];
      let confidence = 75;

      // Multi-strategy file extraction with comprehensive fallbacks
      const extractionResult = await this.extractGitHubFiles();
      files.push(...extractionResult.files);
      confidence += extractionResult.confidenceBonus;

      // Extract visible file content if available
      const fileContent = document.querySelector('.blob-wrapper .blob-code-content, .markdown-body');
      if (fileContent) {
        const content = fileContent.textContent || '';
        const currentFile = window.location.pathname.split('/').pop() || 'unknown';
        
        files.push({
          path: currentFile,
          language: this.detectLanguageFromPath(currentFile),
          content,
          lines: content.split('\n').length,
          size: new TextEncoder().encode(content).length
        });
        confidence += 5;
      }

      return {
        files,
        confidence: Math.min(100, confidence),
        metadata: {
          fileCount: files.length,
          hasPackageJson: GitHubDetector.hasPackageJson(),
          hasReadme: GitHubDetector.hasReadme(),
          hasTsConfig: GitHubDetector.hasTsConfig(),
          repository: this.extractGitHubRepo()
        }
      };
    } catch (error) {
      console.warn('GitHub context extraction failed:', error);
      return this.getFallbackExtractedData();
    }
  }

  /**
   * Multi-strategy GitHub file extraction with comprehensive fallbacks
   */
  private async extractGitHubFiles(): Promise<{ files: FileInfo[]; confidenceBonus: number }> {
    const files: FileInfo[] = [];
    let confidenceBonus = 0;

    // Strategy 1: Modern GitHub file tree (2024+)
    const strategy1Files = this.extractFileTreeStrategy1();
    if (strategy1Files.length > 0) {
      files.push(...strategy1Files);
      confidenceBonus += 15;
      console.log(`GitHub Strategy 1: Found ${strategy1Files.length} files`);
      return { files, confidenceBonus };
    }

    // Strategy 2: Legacy GitHub file tree (2023)
    const strategy2Files = this.extractFileTreeStrategy2();
    if (strategy2Files.length > 0) {
      files.push(...strategy2Files);
      confidenceBonus += 10;
      console.log(`GitHub Strategy 2: Found ${strategy2Files.length} files`);
      return { files, confidenceBonus };
    }

    // Strategy 3: GitHub API-based extraction (fallback)
    const strategy3Files = await this.extractFileTreeStrategy3();
    if (strategy3Files.length > 0) {
      files.push(...strategy3Files);
      confidenceBonus += 12;
      console.log(`GitHub Strategy 3: Found ${strategy3Files.length} files`);
      return { files, confidenceBonus };
    }

    // Strategy 4: Breadcrumb and URL parsing (last resort)
    const strategy4Files = this.extractFileTreeStrategy4();
    if (strategy4Files.length > 0) {
      files.push(...strategy4Files);
      confidenceBonus += 5;
      console.log(`GitHub Strategy 4: Found ${strategy4Files.length} files`);
    }

    return { files, confidenceBonus };
  }

  /**
   * Strategy 1: Modern GitHub file tree with role attributes and React components
   */
  private extractFileTreeStrategy1(): FileInfo[] {
    const files: FileInfo[] = [];
    const selectors = [
      '[role="rowheader"] .Link--primary',
      '[role="gridcell"] a[href*="/blob/"]',
      '[data-testid="file-tree"] a',
      '.react-directory-filename-column a',
      '[role="row"] [role="gridcell"]:first-child a'
    ];

    for (const selector of selectors) {
      try {
        const elements = document.querySelectorAll(selector);
        if (elements.length > 0) {
          elements.forEach((element) => {
            const fileName = element.textContent?.trim();
            const href = element.getAttribute('href');
            if (fileName && href) {
              files.push({
                path: fileName,
                language: this.detectLanguageFromPath(fileName),
                content: '', // Not available in file tree view
                lines: 0,
                size: 0
              });
            }
          });
          break; // Found working selector
        }
      } catch (error) {
        console.warn(`GitHub Strategy 1 selector failed: ${selector}`, error);
      }
    }

    return files;
  }

  /**
   * Strategy 2: Legacy GitHub file tree with navigation classes
   */
  private extractFileTreeStrategy2(): FileInfo[] {
    const files: FileInfo[] = [];
    const selectors = [
      '.js-navigation-open',
      '.content a[href*="/blob/"]',
      '.file-wrap .content a',
      '.repository-content a[title]',
      '[data-pjax] .content a'
    ];

    for (const selector of selectors) {
      try {
        const elements = document.querySelectorAll(selector);
        if (elements.length > 0) {
          elements.forEach((element) => {
            const fileName = element.textContent?.trim() || element.getAttribute('title');
            const href = element.getAttribute('href');
            if (fileName && href && href.includes('/blob/')) {
              files.push({
                path: fileName,
                language: this.detectLanguageFromPath(fileName),
                content: '',
                lines: 0,
                size: 0
              });
            }
          });
          break;
        }
      } catch (error) {
        console.warn(`GitHub Strategy 2 selector failed: ${selector}`, error);
      }
    }

    return files;
  }

  /**
   * Strategy 3: GitHub API-based extraction using repository metadata
   */
  private async extractFileTreeStrategy3(): Promise<FileInfo[]> {
    try {
      const pathParts = window.location.pathname.split('/');
      if (pathParts.length < 3) return [];

      // const owner = pathParts[1];
      // const repo = pathParts[2];
      
      // Look for repository metadata in the page
      const repoMetadata = document.querySelector('[data-repository]');
      if (repoMetadata) {
        const repoData = repoMetadata.getAttribute('data-repository');
        if (repoData) {
          // Parse common file types from repository language information
          const languageData = document.querySelector('.BorderGrid-cell .color-fg-default');
          if (languageData) {
            const language = languageData.textContent?.toLowerCase() || '';
            return this.generateTypicalFilesForLanguage(language);
          }
        }
      }

      // Fallback: Extract from repository topics/tags
      const topics = document.querySelectorAll('[data-octo-click="topic_click"] .topic-tag');
      const topicStrings = Array.from(topics).map(t => t.textContent?.toLowerCase() || '');
      
      if (topicStrings.length > 0) {
        return this.generateTypicalFilesForTopics(topicStrings);
      }

    } catch (error) {
      console.warn('GitHub Strategy 3 failed:', error);
    }

    return [];
  }

  /**
   * Strategy 4: Breadcrumb and URL parsing (last resort)
   */
  private extractFileTreeStrategy4(): FileInfo[] {
    const files: FileInfo[] = [];
    
    try {
      // Extract current file from URL if in blob view
      const pathParts = window.location.pathname.split('/');
      const blobIndex = pathParts.findIndex(part => part === 'blob');
      
      if (blobIndex !== -1 && pathParts.length > blobIndex + 2) {
        const filePath = pathParts.slice(blobIndex + 2).join('/');
        const fileName = pathParts[pathParts.length - 1] || 'unknown';
        
        files.push({
          path: filePath,
          language: this.detectLanguageFromPath(fileName),
          content: this.extractCurrentFileContent(),
          lines: this.countLinesInCurrentFile(),
          size: this.estimateCurrentFileSize()
        });
      }

      // Look for breadcrumb files
      const breadcrumbs = document.querySelectorAll('nav[aria-label="Breadcrumb"] a, .breadcrumb a');
      breadcrumbs.forEach((breadcrumb) => {
        const text = breadcrumb.textContent?.trim();
        if (text && text.includes('.')) {
          files.push({
            path: text,
            language: this.detectLanguageFromPath(text),
            content: '',
            lines: 0,
            size: 0
          });
        }
      });

    } catch (error) {
      console.warn('GitHub Strategy 4 failed:', error);
    }

    return files;
  }

  /**
   * Generate typical files for detected programming language
   */
  private generateTypicalFilesForLanguage(language: string): FileInfo[] {
    const files: FileInfo[] = [];
    
    const languagePatterns: Record<string, string[]> = {
      'javascript': ['package.json', 'index.js', 'README.md', '.gitignore'],
      'typescript': ['package.json', 'tsconfig.json', 'index.ts', 'README.md'],
      'python': ['requirements.txt', 'main.py', 'setup.py', 'README.md'],
      'java': ['pom.xml', 'Main.java', 'README.md', 'gradle.properties'],
      'go': ['go.mod', 'main.go', 'README.md', 'Dockerfile'],
      'rust': ['Cargo.toml', 'main.rs', 'README.md', 'Cargo.lock']
    };

    const typical = languagePatterns[language];
    if (typical) {
      typical.forEach(fileName => {
        files.push({
          path: fileName,
          language: this.detectLanguageFromPath(fileName),
          content: '',
          lines: 0,
          size: 0
        });
      });
    }

    return files;
  }

  /**
   * Generate typical files based on repository topics
   */
  private generateTypicalFilesForTopics(topics: string[]): FileInfo[] {
    const files: FileInfo[] = [];
    
    if (topics.some(t => ['react', 'vue', 'angular', 'frontend'].includes(t))) {
      files.push(
        { path: 'package.json', language: 'JSON', content: '', lines: 0, size: 0 },
        { path: 'src/index.js', language: 'JavaScript', content: '', lines: 0, size: 0 }
      );
    }
    
    if (topics.some(t => ['docker', 'containerization'].includes(t))) {
      files.push(
        { path: 'Dockerfile', language: 'Dockerfile', content: '', lines: 0, size: 0 },
        { path: 'docker-compose.yml', language: 'YAML', content: '', lines: 0, size: 0 }
      );
    }
    
    if (topics.some(t => ['kubernetes', 'k8s'].includes(t))) {
      files.push(
        { path: 'deployment.yaml', language: 'YAML', content: '', lines: 0, size: 0 }
      );
    }

    return files;
  }

  /**
   * Extract content from currently viewed file
   */
  private extractCurrentFileContent(): string {
    const selectors = [
      '.blob-wrapper .blob-code-content',
      '.markdown-body',
      '.file-editor-textarea',
      'pre.highlight',
      '.blob-code-inner'
    ];

    for (const selector of selectors) {
      const element = document.querySelector(selector);
      if (element) {
        return element.textContent || '';
      }
    }

    return '';
  }

  /**
   * Count lines in currently viewed file
   */
  private countLinesInCurrentFile(): number {
    const content = this.extractCurrentFileContent();
    return content ? content.split('\n').length : 0;
  }

  /**
   * Estimate size of currently viewed file
   */
  private estimateCurrentFileSize(): number {
    const content = this.extractCurrentFileContent();
    return new TextEncoder().encode(content).length;
  }

  private async extractCodeMirrorContext(): Promise<ExtractedData> {
    try {
      const files: FileInfo[] = [];
      
      // Try multiple CodeMirror detection strategies
      if (window.CodeMirror?.instances) {
        window.CodeMirror.instances.forEach((editor, index) => {
          try {
            const content = editor.getValue();
            const mode = editor.getMode();
            const language = mode?.name || 'text';

            files.push({
              path: `editor_${index + 1}.${this.getExtensionFromLanguage(language)}`,
              language,
              content,
              lines: content.split('\n').length,
              size: content.length
            });
          } catch (error) {
            console.warn(`Failed to extract from CodeMirror instance ${index}:`, error);
          }
        });
      }

      // Fallback: Look for CodeMirror DOM elements
      if (files.length === 0) {
        const cmElements = document.querySelectorAll('.CodeMirror');
        cmElements.forEach((element, index) => {
          try {
            const content = element.textContent || '';
            if (content.length > 10) { // Only include substantial content
              files.push({
                path: `codemirror_${index + 1}.txt`,
                language: 'text',
                content,
                lines: content.split('\n').length,
                size: content.length
              });
            }
          } catch (error) {
            console.warn(`Failed to extract from CodeMirror DOM ${index}:`, error);
          }
        });
      }

      return {
        files,
        confidence: files.length > 0 ? 85 : 40,
        metadata: {
          editorType: 'codemirror',
          instanceCount: files.length
        }
      };
    } catch (error) {
      console.warn('CodeMirror context extraction failed:', error);
      return this.getFallbackExtractedData();
    }
  }

  private async extractStackBlitzContext(): Promise<ExtractedData> {
    try {
      // StackBlitz often uses Monaco under the hood
      if (this.isMonacoAvailable()) {
        const monacoData = await this.extractMonacoContext();
        return {
          ...monacoData,
          confidence: Math.min(95, monacoData.confidence),
          metadata: {
            ...monacoData.metadata,
            platform: 'stackblitz'
          }
        };
      }

      // Fallback to DOM analysis
      return this.extractGenericContext();
    } catch (error) {
      console.warn('StackBlitz context extraction failed:', error);
      return this.getFallbackExtractedData();
    }
  }

  private async extractCodeSandboxContext(): Promise<ExtractedData> {
    try {
      // CodeSandbox often uses Monaco
      if (this.isMonacoAvailable()) {
        const monacoData = await this.extractMonacoContext();
        return {
          ...monacoData,
          confidence: Math.min(95, monacoData.confidence),
          metadata: {
            ...monacoData.metadata,
            platform: 'codesandbox'
          }
        };
      }

      return this.extractGenericContext();
    } catch (error) {
      console.warn('CodeSandbox context extraction failed:', error);
      return this.getFallbackExtractedData();
    }
  }

  private async extractLocalhostContext(): Promise<ExtractedData> {
    try {
      // Check for development server indicators
      const title = document.title.toLowerCase();
      const hasDevServer = title.includes('webpack') || title.includes('vite') || title.includes('dev server');
      
      return this.extractGenericContext(hasDevServer ? 60 : 40);
    } catch (error) {
      console.warn('Localhost context extraction failed:', error);
      return this.getFallbackExtractedData();
    }
  }

  private async extractGenericContext(baseConfidence = 30): Promise<ExtractedData> {
    try {
      const files: FileInfo[] = [];
      const codeBlocks = document.querySelectorAll('pre code, .highlight, .hljs');
      
      codeBlocks.forEach((block, index) => {
        const content = block.textContent || '';
        if (content.length > 20) { // Only substantial code blocks
          const language = this.detectLanguageFromElement(block);
          
          files.push({
            path: `code_block_${index + 1}.${this.getExtensionFromLanguage(language)}`,
            language,
            content,
            lines: content.split('\n').length,
            size: content.length
          });
        }
      });

      const confidence = Math.min(60, baseConfidence + (files.length * 5));

      return {
        files,
        confidence,
        metadata: {
          codeBlockCount: files.length,
          extractionMethod: 'generic-dom'
        }
      };
    } catch (error) {
      console.warn('Generic context extraction failed:', error);
      return this.getFallbackExtractedData();
    }
  }

  /**
   * Helper methods for context building
   */
  private buildCodeContext(platform: Platform, data: ExtractedData): CodeContext {
    return {
      platform,
      score: makeScore(data.confidence),
      structure: {
        files: data.files,
        directories: this.extractDirectories(data.files),
        entryPoints: this.detectEntryPoints(data.files),
        totalFiles: data.files.length,
        totalLines: data.files.reduce((sum, f) => sum + f.lines, 0)
      },
      dependencies: {
        runtime: {
          language: this.detectPrimaryLanguage(data.files),
          version: 'Unknown',
          packageManager: 'npm'
        },
        packages: [],
        lockFile: null
      },
      environment: {
        variables: [],
        configFiles: []
      },
      metadata: {
        extractionTime: performance.now(),
        version: '1.0.0',
        timestamp: new Date().toISOString(),
        url: window.location.href,
        userAgent: navigator.userAgent
      }
    };
  }

  private buildFallbackContext(): CodeContext {
    return {
      platform: 'unknown',
      score: makeScore(25),
      structure: {
        files: [],
        directories: [],
        entryPoints: [],
        totalFiles: 0,
        totalLines: 0
      },
      dependencies: {
        runtime: {
          language: 'Unknown',
          version: 'Unknown',
          packageManager: 'unknown'
        },
        packages: [],
        lockFile: null
      },
      environment: {
        variables: [],
        configFiles: []
      },
      metadata: {
        extractionTime: performance.now(),
        version: '1.0.0',
        timestamp: new Date().toISOString(),
        url: window.location.href,
        userAgent: navigator.userAgent
      }
    };
  }

  private getFallbackExtractedData(): ExtractedData {
    return {
      files: [],
      confidence: 25,
      metadata: {
        extractionMethod: 'fallback'
      }
    };
  }

  private extractGitHubRepo(): string {
    const pathParts = this.pathname.split('/');
    if (pathParts.length >= 3) {
      return `${pathParts[1]}/${pathParts[2]}`;
    }
    return 'unknown';
  }

  private detectLanguageFromPath(filename: string): string {
    const ext = filename.split('.').pop()?.toLowerCase();
    const langMap: Record<string, string> = {
      'ts': 'typescript',
      'js': 'javascript',
      'py': 'python',
      'java': 'java',
      'cpp': 'cpp',
      'c': 'c',
      'cs': 'csharp',
      'php': 'php',
      'rb': 'ruby',
      'go': 'go',
      'rs': 'rust',
      'html': 'html',
      'css': 'css',
      'scss': 'scss',
      'json': 'json',
      'xml': 'xml',
      'yml': 'yaml',
      'yaml': 'yaml',
      'md': 'markdown'
    };
    return langMap[ext || ''] || 'text';
  }

  private detectLanguageFromElement(element: Element): string {
    // Check class names for language hints
    const classList = Array.from(element.classList);
    for (const className of classList) {
      if (className.startsWith('language-')) {
        return className.replace('language-', '');
      }
      if (className.startsWith('lang-')) {
        return className.replace('lang-', '');
      }
    }
    return 'text';
  }

  private getExtensionFromLanguage(language: string): string {
    const extensions: Record<string, string> = {
      javascript: 'js',
      typescript: 'ts',
      python: 'py',
      java: 'java',
      cpp: 'cpp',
      csharp: 'cs',
      php: 'php',
      ruby: 'rb',
      go: 'go',
      rust: 'rs',
      html: 'html',
      css: 'css',
      json: 'json',
      xml: 'xml',
      yaml: 'yml',
      markdown: 'md'
    };

    return extensions[language.toLowerCase()] || 'txt';
  }

  /**
   * @deprecated Use detect() instead. This sync method is unsafe and will be removed.
   * Kept only for backward compatibility during transition.
   */
  detectPlatform(): Platform {
    console.warn('⚠️ detectPlatform() is deprecated. Use await detect() instead to avoid race conditions.');
    
    // If we have a fresh cached result, return it
    const cached = this.getCached();
    if (cached) {
      return cached;
    }
    
    // Otherwise, return fast path result only (limited accuracy)
    return this.detectFastPath();
  }

  extractContext(): CodeContext {
    // For sync compatibility, build basic context from fast path
    const platform = this.detectFastPath();
    
    return {
      platform,
      score: makeScore(platform === 'unknown' ? 25 : 75),
      structure: {
        files: [],
        directories: [],
        entryPoints: [],
        totalFiles: 0,
        totalLines: 0
      },
      dependencies: {
        runtime: {
          language: 'Unknown',
          version: 'Unknown',
          packageManager: 'npm'
        },
        packages: [],
        lockFile: null
      },
      environment: {
        variables: [],
        configFiles: []
      },
      metadata: {
        extractionTime: performance.now(),
        version: '1.0.0',
        timestamp: new Date().toISOString(),
        url: window.location.href,
        userAgent: navigator.userAgent
      }
    };
  }

  private extractDirectories(files: readonly FileInfo[]): readonly string[] {
    const dirs = new Set<string>();
    files.forEach(file => {
      const pathParts = file.path.split('/');
      if (pathParts.length > 1 && pathParts[0]) {
        dirs.add(pathParts[0]);
      }
    });
    return Array.from(dirs);
  }

  private detectEntryPoints(files: readonly FileInfo[]): readonly string[] {
    const entryPoints: string[] = [];
    const entryPatterns = ['index.', 'main.', 'app.', 'server.'];
    
    files.forEach(file => {
      const filename = file.path.split('/').pop() ?? '';
      if (entryPatterns.some(pattern => filename.startsWith(pattern))) {
        entryPoints.push(file.path);
      }
    });
    
    return entryPoints;
  }

  private detectPrimaryLanguage(files: readonly FileInfo[]): string {
    if (files.length === 0) return 'Unknown';
    
    const languageCounts = new Map<string, number>();
    files.forEach(file => {
      const count = languageCounts.get(file.language) ?? 0;
      languageCounts.set(file.language, count + 1);
    });
    
    let maxCount = 0;
    let primaryLanguage = 'Unknown';
    for (const [lang, count] of languageCounts) {
      if (count > maxCount) {
        maxCount = count;
        primaryLanguage = lang;
      }
    }
    
    return primaryLanguage;
  }
}

/**
 * Platform-specific extractors
 */
export class PlatformExtractors {
  static extractMonacoFiles(): readonly FileInfo[] {
    if (!window.monaco?.editor) {
      return [];
    }

    try {
      const models = window.monaco.editor.getModels();
      return models.map((model): FileInfo => {
        const uri = model.uri.toString();
        const language = model.getLanguageId();
        const content = model.getValue();

        return {
          path: uri.replace(/^file:\/\/\//, ''),
          language,
          content,
          lines: content.split('\n').length,
          size: content.length
        };
      });
    } catch (error) {
      return [];
    }
  }

  static extractCodeMirrorFiles(): readonly FileInfo[] {
    const codeMirror = window.CodeMirror;
    if (!codeMirror?.instances) {
      return [];
    }

    try {
      return codeMirror.instances.map((editor, index): FileInfo => {
        const content = editor.getValue();
        const mode = editor.getMode();
        const language = mode.name ?? 'text';

        return {
          path: `file_${index + 1}.${this.getExtensionFromLanguage(language)}`,
          language,
          content,
          lines: content.split('\n').length,
          size: content.length
        };
      });
    } catch (error) {
      return [];
    }
  }

  static extractVSCodeWebFiles(): readonly FileInfo[] {
    try {
      const editors = document.querySelectorAll('.monaco-editor .view-lines');
      const files: FileInfo[] = [];

      editors.forEach((editor, index) => {
        const content = editor.textContent ?? '';
        files.push({
          path: `file_${index + 1}.txt`,
          language: 'text',
          content,
          lines: content.split('\n').length,
          size: content.length
        });
      });

      return files;
    } catch (error) {
      return [];
    }
  }

  private static getExtensionFromLanguage(language: string): string {
    const extensions: Record<string, string> = {
      javascript: 'js',
      typescript: 'ts',
      python: 'py',
      java: 'java',
      cpp: 'cpp',
      csharp: 'cs',
      php: 'php',
      ruby: 'rb',
      go: 'go',
      rust: 'rs',
      html: 'html',
      css: 'css',
      json: 'json',
      xml: 'xml',
      yaml: 'yml',
      markdown: 'md'
    };

    return extensions[language.toLowerCase()] ?? 'txt';
  }
}

/**
 * GitHub-specific bonus detectors
 */
export class GitHubDetector {
  static hasPackageJson(): boolean {
    const selectors = [
      'a[href*="package.json"]',
      '[role="rowheader"]:has-text("package.json")',
      '.js-navigation-open[title*="package.json"]',
      '[data-testid="file-tree"] a[title*="package.json"]',
      'a[href$="/package.json"]'
    ];
    return selectors.some(selector => {
      try {
        return document.querySelector(selector) !== null;
      } catch (e) {
        return false;
      }
    });
  }

  static hasEnvironmentFile(): boolean {
    const envSelectors = [
      'a[href*=".env"]',
      'a[href*=".env.local"]',
      'a[href*=".env.example"]',
      'a[href*=".env.production"]',
      'a[href*=".env.development"]',
      '[role="rowheader"]:has-text(".env")',
      '.js-navigation-open[title*=".env"]',
      '[data-testid="file-tree"] a[title*=".env"]'
    ];
    return envSelectors.some(selector => {
      try {
        return document.querySelector(selector) !== null;
      } catch (e) {
        return false;
      }
    });
  }

  static hasReadme(): boolean {
    const readmeSelectors = [
      'a[href*="README.md"]',
      'a[href*="README.rst"]',
      'a[href*="README.txt"]',
      'a[href*="readme.md"]',
      'a[href*="Readme.md"]',
      '[role="rowheader"]:has-text("README")',
      '.js-navigation-open[title*="README"]',
      '[data-testid="file-tree"] a[title*="README"]',
      'a[href$="/README.md"]',
      'a[href$="/readme.md"]'
    ];
    return readmeSelectors.some(selector => {
      try {
        return document.querySelector(selector) !== null;
      } catch (e) {
        return false;
      }
    });
  }

  static hasDockerfile(): boolean {
    const selectors = [
      'a[href*="Dockerfile"]',
      'a[href*="dockerfile"]',
      '[role="rowheader"]:has-text("Dockerfile")',
      '.js-navigation-open[title*="Dockerfile"]',
      '[data-testid="file-tree"] a[title*="Dockerfile"]',
      'a[href$="/Dockerfile"]'
    ];
    return selectors.some(selector => {
      try {
        return document.querySelector(selector) !== null;
      } catch (e) {
        return false;
      }
    });
  }

  static hasTsConfig(): boolean {
    const selectors = [
      'a[href*="tsconfig.json"]',
      '[role="rowheader"]:has-text("tsconfig.json")',
      '.js-navigation-open[title*="tsconfig.json"]',
      '[data-testid="file-tree"] a[title*="tsconfig.json"]',
      'a[href$="/tsconfig.json"]'
    ];
    return selectors.some(selector => {
      try {
        return document.querySelector(selector) !== null;
      } catch (e) {
        return false;
      }
    });
  }

  static hasConfigFiles(): boolean {
    const configSelectors = [
      'a[href*="webpack.config"]',
      'a[href*="vite.config"]',
      'a[href*="rollup.config"]',
      'a[href*="babel.config"]',
      'a[href*="eslint.config"]',
      'a[href*="next.config"]',
      'a[href*="nuxt.config"]',
      'a[href*="tailwind.config"]',
      '[role="rowheader"]:has-text("config")',
      '.js-navigation-open[title*="config"]',
      '[data-testid="file-tree"] a[title*="config"]',
      'a[href$=".config.js"]',
      'a[href$=".config.ts"]',
      'a[href$=".config.json"]'
    ];
    return configSelectors.some(selector => {
      try {
        return document.querySelector(selector) !== null;
      } catch (e) {
        return false;
      }
    });
  }

  /**
   * Advanced GitHub file detection with retry mechanism
   */
  static async detectFilesWithRetry(): Promise<{ files: string[]; confidence: number }> {
    let files: string[] = [];
    let confidence = 0;
    let attempts = 0;
    const maxAttempts = 3;

    while (attempts < maxAttempts && files.length === 0) {
      try {
        // Strategy 1: Modern GitHub
        const modernFiles = GitHubDetector.extractModernGitHubFiles();
        if (modernFiles.length > 0) {
          files = modernFiles;
          confidence = 90;
          break;
        }

        // Strategy 2: Legacy GitHub  
        const legacyFiles = GitHubDetector.extractLegacyGitHubFiles();
        if (legacyFiles.length > 0) {
          files = legacyFiles;
          confidence = 75;
          break;
        }

        // Strategy 3: Text-based extraction
        const textFiles = GitHubDetector.extractFilesFromText();
        if (textFiles.length > 0) {
          files = textFiles;
          confidence = 60;
        }

        attempts++;
        if (attempts < maxAttempts) {
          // Wait briefly before retry
          await new Promise(resolve => setTimeout(resolve, 100));
        }

      } catch (error) {
        console.warn(`GitHub file detection attempt ${attempts + 1} failed:`, error);
        attempts++;
      }
    }

    return { files, confidence };
  }

  /**
   * Extract files using modern GitHub selectors
   */
  static extractModernGitHubFiles(): string[] {
    const selectors = [
      '[role="rowheader"] .Link--primary',
      '[role="gridcell"] a[href*="/blob/"]',
      '[data-testid="file-tree"] a',
      '.react-directory-filename-column a'
    ];

    for (const selector of selectors) {
      try {
        const elements = document.querySelectorAll(selector);
        if (elements.length > 0) {
          return Array.from(elements)
            .map(el => el.textContent?.trim())
            .filter(Boolean) as string[];
        }
      } catch (error) {
        console.warn(`Modern GitHub selector failed: ${selector}`, error);
      }
    }

    return [];
  }

  /**
   * Extract files using legacy GitHub selectors
   */
  static extractLegacyGitHubFiles(): string[] {
    const selectors = [
      '.js-navigation-open',
      '.content a[href*="/blob/"]',
      '.file-wrap .content a',
      '.repository-content a[title]'
    ];

    for (const selector of selectors) {
      try {
        const elements = document.querySelectorAll(selector);
        if (elements.length > 0) {
          return Array.from(elements)
            .map(el => el.textContent?.trim() || el.getAttribute('title'))
            .filter(Boolean) as string[];
        }
      } catch (error) {
        console.warn(`Legacy GitHub selector failed: ${selector}`, error);
      }
    }

    return [];
  }

  /**
   * Extract files from page text content (last resort)
   */
  static extractFilesFromText(): string[] {
    try {
      const bodyText = document.body.textContent || '';
      const filePatterns = [
        /\b[\w-]+\.(js|ts|jsx|tsx|py|java|go|rs|cpp|c|h|php|rb)\b/g,
        /\b(package\.json|tsconfig\.json|Dockerfile|README\.md|\.gitignore)\b/g
      ];

      const files = new Set<string>();
      
      filePatterns.forEach(pattern => {
        const matches = bodyText.match(pattern);
        if (matches) {
          matches.forEach(match => files.add(match));
        }
      });

      return Array.from(files).slice(0, 20); // Limit to prevent noise
    } catch (error) {
      console.warn('Text-based file extraction failed:', error);
      return [];
    }
  }

  static getBonusFeatures(): readonly string[] {
    const features: string[] = [];

    if (this.hasPackageJson()) features.push('package-json');
    if (this.hasEnvironmentFile()) features.push('env-file');
    if (this.hasReadme()) features.push('readme');
    if (this.hasDockerfile()) features.push('dockerfile');
    if (this.hasTsConfig()) features.push('typescript');
    if (this.hasConfigFiles()) features.push('config-files');

    return features;
  }
}

/**
 * Generic code block detector for any page
 */
export class CodeBlockDetector {
  static countCodeBlocks(): number {
    const selectors = [
      'pre',
      'code',
      '.highlight',
      '.code',
      '.hljs',
      '[class*="language-"]',
      '[class*="lang-"]'
    ];

    let totalCount = 0;
    selectors.forEach(selector => {
      totalCount += document.querySelectorAll(selector).length;
    });

    return totalCount;
  }

  static getCodeLanguages(): readonly string[] {
    const languageClasses = document.querySelectorAll('[class*="language-"], [class*="lang-"]');
    const languages = new Set<string>();

    languageClasses.forEach(element => {
      const classList = Array.from(element.classList);
      classList.forEach(className => {
        if (className.startsWith('language-')) {
          languages.add(className.replace('language-', ''));
        } else if (className.startsWith('lang-')) {
          languages.add(className.replace('lang-', ''));
        }
      });
    });

    return Array.from(languages);
  }
}