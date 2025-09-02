/**
 * FAF Extraction Engine - Main orchestrator for context extraction
 */

import type { 
  CodeContext, 
  ExtractionResult, 
  FAFFile, 
  Platform,
  ProjectStructure,
  Dependencies,
  Environment,
  ExtractionMetadata,
  RuntimeInfo,
  FileInfo,
  DependencyInfo,
  EnvironmentVariable
} from '@/core/types';

import { 
  PlatformDetector, 
  PlatformExtractors, 
  GitHubDetector,
  CodeBlockDetector 
} from '@/adapters/platforms';

import { ScoringEngine } from '@/core/scorer';
import { telemetry, trackPerformance } from '@/core/telemetry';
import { 
  FAFError, 
  FAFErrorCode, 
  FAFErrorSeverity,
  FAFRecoveryStrategy 
} from '@/core/errors';
import { errorRecovery } from '@/core/error-recovery';

export interface ExtractionOptions {
  readonly timeout: number;
  readonly includeContent: boolean;
  readonly maxFileSize: number;
  readonly maxFiles: number;
}

export const DEFAULT_OPTIONS: ExtractionOptions = {
  timeout: 300, // 300ms requirement
  includeContent: true,
  maxFileSize: 100_000, // 100KB per file
  maxFiles: 50
} as const;

/**
 * Main FAF extraction engine with <300ms performance guarantee
 */
export class FAFEngine {
  private readonly options: ExtractionOptions;
  private readonly scorer: ScoringEngine;
  private readonly startTime: number;

  constructor(options: ExtractionOptions = DEFAULT_OPTIONS) {
    this.options = options;
    this.scorer = new ScoringEngine();
    this.startTime = performance.now();
  }

  /**
   * Extract complete context from current page
   */
  async extract(): Promise<ExtractionResult> {
    return errorRecovery.withRecovery(
      async () => {
        // Get platform quickly for early telemetry (will use cache if available)
        const earlyDetector = new PlatformDetector();
        const cachedPlatform = earlyDetector.getCached() || 'unknown';
        
        // Track extraction start
        telemetry.trackExtraction('start', {
          platform: cachedPlatform,
        });

        const timeoutPromise = new Promise<never>((_, reject) => {
          setTimeout(() => {
            reject(new FAFError(
              FAFErrorCode.EXTRACTION_TIMEOUT,
              `Extraction timeout after ${this.options.timeout}ms`,
              {
                context: { timeout: this.options.timeout }
              }
            ));
          }, this.options.timeout);
        });

        const result = await trackPerformance('extraction_total', async () => {
          return Promise.race([
            this.performExtraction(),
            timeoutPromise
          ]);
        }, this.options.timeout);

        // Track successful extraction
        telemetry.trackExtraction('complete', {
          platform: result.context.platform,
          score: result.score,
          duration: result.context.metadata.extractionTime,
          fileCount: result.context.structure.totalFiles
        });

        return { success: true, faf: result };
      },
      {
        operationId: 'faf_extraction',
        retryConfig: {
          maxAttempts: 2,
          baseDelay: 100,
          maxDelay: 500
        },
        fallbackOperation: async () => {
          // Fallback extraction with minimal context
          const duration = performance.now() - this.startTime;
          
          telemetry.trackExtraction('fallback', {
            duration
          });

          return {
            success: false,
            error: 'Extraction failed - minimal context available',
            code: 'FALLBACK_MODE' as const
          };
        },
        context: 'FAFEngine.extract'
      }
    ).catch((error) => {
      const duration = performance.now() - this.startTime;
      const fafError = error instanceof FAFError ? error : FAFError.fromUnknown(error);
      
      // Track extraction error
      telemetry.trackExtraction('error', {
        error: fafError.message,
        code: fafError.code,
        duration
      });

      return {
        success: false,
        error: fafError.userMessage,
        code: fafError.code
      };
    });
  }

  /**
   * Perform the actual extraction work
   */
  private async performExtraction(): Promise<FAFFile> {
    try {
      // Detect platform first (fastest operation) with telemetry
      const detector = new PlatformDetector();
      const platform = await trackPerformance('platform_detection', async () => {
        return detector.detect();
      }, 50); // 50ms threshold for platform detection
      
      telemetry.track('platform_detected', { platform });
      
      // Extract data concurrently for performance with individual tracking
      const [structure, dependencies, environment] = await Promise.all([
        this.extractStructureWithErrorHandling(platform),
        this.extractDependenciesWithErrorHandling(platform),
        this.extractEnvironmentWithErrorHandling(platform)
      ]);

      // Create preliminary context for scoring
      const preliminaryContext = {
        platform: platform,
        structure,
        dependencies,
        environment,
        metadata: this.createMetadata()
      };

      // Calculate final score
      const score = this.scorer.calculateScore(preliminaryContext as CodeContext);

      // Build complete context
      const context: CodeContext = {
        ...preliminaryContext,
        score
      };

      // Generate FAF file
      return this.generateFAF(context);
    } catch (error) {
      throw error instanceof FAFError ? error : new FAFError(
        FAFErrorCode.EXTRACTION_FAILED,
        'Failed to perform context extraction',
        {
          context: { originalError: error instanceof Error ? error.message : 'Unknown error' }
        }
      );
    }
  }

  /**
   * Extract project structure with error handling
   */
  private async extractStructureWithErrorHandling(platform: Platform): Promise<ProjectStructure> {
    return trackPerformance('structure_extraction', async () => {
      try {
        return await this.extractStructure(platform);
      } catch (error) {
        throw new FAFError(
          FAFErrorCode.STRUCTURE_EXTRACTION_FAILED,
          'Failed to extract project structure',
          {
            context: { 
              platform,
              originalError: error instanceof Error ? error.message : 'Unknown error'
            }
          }
        );
      }
    }, 100);
  }

  /**
   * Extract dependencies with error handling
   */
  private async extractDependenciesWithErrorHandling(platform: Platform): Promise<Dependencies> {
    return trackPerformance('dependencies_extraction', async () => {
      try {
        return await this.extractDependencies(platform);
      } catch (error) {
        throw new FAFError(
          FAFErrorCode.DEPENDENCIES_EXTRACTION_FAILED,
          'Failed to extract dependency information',
          {
            context: { 
              platform,
              originalError: error instanceof Error ? error.message : 'Unknown error'
            }
          }
        );
      }
    }, 50);
  }

  /**
   * Extract environment with error handling
   */
  private async extractEnvironmentWithErrorHandling(platform: Platform): Promise<Environment> {
    return trackPerformance('environment_extraction', async () => {
      try {
        return await this.extractEnvironment(platform);
      } catch (error) {
        throw new FAFError(
          FAFErrorCode.ENVIRONMENT_EXTRACTION_FAILED,
          'Failed to extract environment information',
          {
            context: { 
              platform,
              originalError: error instanceof Error ? error.message : 'Unknown error'
            }
          }
        );
      }
    }, 30);
  }

  /**
   * Extract project structure based on platform
   */
  private async extractStructure(platform: Platform): Promise<ProjectStructure> {
    let files: readonly FileInfo[] = [];

    // Platform-specific extraction
    switch (platform) {
      case 'monaco':
        files = PlatformExtractors.extractMonacoFiles();
        break;
      case 'codemirror':
        files = PlatformExtractors.extractCodeMirrorFiles();
        break;
      case 'vscode-web':
        files = PlatformExtractors.extractVSCodeWebFiles();
        break;
      default:
        files = [];
    }

    // Filter by size and count limits
    const filteredFiles = files
      .filter(file => file.size <= this.options.maxFileSize)
      .slice(0, this.options.maxFiles);

    // Extract directory structure
    const directories = this.extractDirectories(filteredFiles);
    const entryPoints = this.detectEntryPoints(filteredFiles);

    return {
      files: filteredFiles,
      directories,
      entryPoints,
      totalFiles: filteredFiles.length,
      totalLines: filteredFiles.reduce((sum, file) => sum + file.lines, 0)
    };
  }

  /**
   * Extract dependencies information
   */
  private async extractDependencies(platform: Platform): Promise<Dependencies> {
    // Try to detect runtime from various sources
    const runtime = this.detectRuntime();
    
    // For live editors, dependencies are harder to detect
    // Focus on what we can reliably determine
    const packages: readonly DependencyInfo[] = [];
    let lockFile: string | null = null;

    if (platform === 'github') {
      // GitHub can show package.json in file listing
      if (GitHubDetector.hasPackageJson()) {
        // Could potentially extract package names from visible content
        // For now, just indicate presence
      }
    }

    return {
      runtime,
      packages,
      lockFile
    };
  }

  /**
   * Extract environment information
   */
  private async extractEnvironment(platform: Platform): Promise<Environment> {
    const variables: readonly EnvironmentVariable[] = [];
    const configFiles: string[] = [];

    if (platform === 'github') {
      const bonusFeatures = GitHubDetector.getBonusFeatures();
      
      if (bonusFeatures.includes('env-file')) {
        configFiles.push('.env');
      }
      if (bonusFeatures.includes('config-files')) {
        configFiles.push('webpack.config.js', 'vite.config.ts');
      }
    }

    return {
      variables,
      configFiles: configFiles as readonly string[]
    };
  }

  /**
   * Detect runtime information from available clues
   */
  private detectRuntime(): RuntimeInfo {
    // Check for obvious language indicators
    const codeLanguages = CodeBlockDetector.getCodeLanguages();
    
    let language = 'unknown';
    let version = 'unknown';
    let packageManager: RuntimeInfo['packageManager'] = 'unknown';

    // Detect primary language
    if (codeLanguages.includes('typescript') || codeLanguages.includes('ts')) {
      language = 'TypeScript';
    } else if (codeLanguages.includes('javascript') || codeLanguages.includes('js')) {
      language = 'JavaScript';
    } else if (codeLanguages.includes('python') || codeLanguages.includes('py')) {
      language = 'Python';
    } else if (codeLanguages.includes('java')) {
      language = 'Java';
    } else if (codeLanguages.length > 0) {
      language = codeLanguages[0] || 'Unknown';
    }

    // Detect package manager from file indicators
    if (document.querySelector('a[href*="pnpm-lock.yaml"]')) {
      packageManager = 'pnpm';
    } else if (document.querySelector('a[href*="yarn.lock"]')) {
      packageManager = 'yarn';
    } else if (document.querySelector('a[href*="package-lock.json"]')) {
      packageManager = 'npm';
    } else if (document.querySelector('a[href*="bun.lockb"]')) {
      packageManager = 'bun';
    }

    return {
      language,
      version,
      packageManager
    };
  }

  /**
   * Extract directory structure from file paths
   */
  private extractDirectories(files: readonly { path: string }[]): readonly string[] {
    const directories = new Set<string>();
    
    files.forEach(file => {
      const parts = file.path.split('/');
      for (let i = 1; i < parts.length; i++) {
        const dirPath = parts.slice(0, i).join('/');
        if (dirPath) {
          directories.add(dirPath);
        }
      }
    });

    return Array.from(directories).sort();
  }

  /**
   * Detect entry points from file names and extensions
   */
  private detectEntryPoints(files: readonly { path: string; language: string }[]): readonly string[] {
    const entryPoints: string[] = [];
    
    // Common entry point patterns
    const patterns = [
      /^index\.(js|ts|jsx|tsx)$/,
      /^main\.(js|ts|jsx|tsx)$/,
      /^app\.(js|ts|jsx|tsx)$/,
      /^server\.(js|ts)$/,
      /^index\.html$/,
      /^package\.json$/,
      /^README\.(md|rst|txt)$/i
    ];

    files.forEach(file => {
      const filename = file.path.split('/').pop() ?? '';
      if (patterns.some(pattern => pattern.test(filename))) {
        entryPoints.push(file.path);
      }
    });

    return entryPoints as readonly string[];
  }

  /**
   * Create extraction metadata
   */
  private createMetadata(): ExtractionMetadata {
    return {
      extractionTime: performance.now() - this.startTime,
      version: '1.0.0',
      timestamp: new Date().toISOString(),
      url: window.location.href,
      userAgent: navigator.userAgent
    };
  }

  /**
   * Generate complete FAF file
   */
  private generateFAF(context: CodeContext): FAFFile {
    const summary = this.generateSummary(context);
    const aiInstructions = this.generateAIInstructions(context);
    const checksum = this.generateChecksum(context);
    
    return {
      version: '1.0.0',
      generated: new Date().toISOString(),
      score: context.score,
      context,
      summary,
      ai_instructions: aiInstructions,
      checksum,
      compressed: false,
      size: JSON.stringify(context).length
    };
  }

  /**
   * Generate human-readable summary
   */
  private generateSummary(context: CodeContext): string {
    const score = context.score as number;
    const files = context.structure.totalFiles;
    const lines = context.structure.totalLines;
    
    let summary = `${context.platform} project with ${score}% context confidence.`;
    
    if (files > 0) {
      summary += ` Contains ${files} files (${lines} lines total).`;
    }
    
    if (context.dependencies.runtime.language !== 'unknown') {
      summary += ` Primary language: ${context.dependencies.runtime.language}.`;
    }
    
    return summary;
  }

  /**
   * Generate AI-specific instructions
   */
  private generateAIInstructions(context: CodeContext): string {
    const score = context.score as number;
    const platform = context.platform;
    
    let instructions = `Context extracted from ${platform} with ${score}% confidence. `;
    
    if (score >= 80) {
      instructions += 'High confidence - Full project context available. ';
      instructions += 'You have access to complete file structure, dependencies, and configuration. ';
      instructions += 'Provide detailed, project-specific assistance.';
    } else if (score >= 50) {
      instructions += 'Medium confidence - Partial context available. ';
      instructions += 'Basic project information is present but some details may be incomplete. ';
      instructions += 'Ask for clarification on specific implementation details if needed.';
    } else {
      instructions += 'Low confidence - Limited context available. ';
      instructions += 'Only basic page information extracted. ';
      instructions += 'Request additional context or code snippets for better assistance.';
    }
    
    return instructions;
  }

  /**
   * Generate verification checksum
   */
  private generateChecksum(context: CodeContext): string {
    const data = JSON.stringify(context);
    // Simple hash - could be replaced with proper crypto hash
    let hash = 0;
    for (let i = 0; i < data.length; i++) {
      const char = data.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(36).padStart(8, '0').substring(0, 8);
  }


  /**
   * @deprecated Use async detect() method instead to avoid race conditions
   */
  detectPlatform(): Platform {
    console.warn('⚠️ FAFEngine.detectPlatform() is deprecated. Use async extraction instead.');
    const detector = new PlatformDetector();
    return detector.detectPlatform();
  }
}