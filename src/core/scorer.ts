/**
 * FAF Scoring Engine - Deterministic scoring with 100% reproducibility
 */

import type { 
  Platform, 
  Score, 
  CodeContext
} from '@/core/types';
import { 
  GitHubDetector, 
  CodeBlockDetector 
} from '@/adapters/platforms';

export interface ScoringWeights {
  readonly platform: number;
  readonly files: number;
  readonly dependencies: number;
  readonly environment: number;
  readonly codeBlocks: number;
  readonly githubFeatures: number;
}

export const DEFAULT_WEIGHTS: ScoringWeights = {
  platform: 0.6,      // 60% - Platform detection is primary
  files: 0.15,        // 15% - File structure
  dependencies: 0.1,   // 10% - Package dependencies
  environment: 0.05,   // 5%  - Environment variables
  codeBlocks: 0.05,    // 5%  - Code blocks on page
  githubFeatures: 0.05 // 5%  - GitHub-specific bonuses
} as const;

/**
 * Deterministic scoring engine with exact reproducibility
 */
export class ScoringEngine {
  private readonly weights: ScoringWeights;

  constructor(weights: ScoringWeights = DEFAULT_WEIGHTS) {
    this.weights = this.validateWeights(weights);
  }

  /**
   * Calculate final score based on all detection factors
   */
  calculateScore(context: CodeContext): Score {
    const platformScore = this.calculatePlatformScore(context.platform);
    const filesScore = this.calculateFilesScore(context);
    const dependenciesScore = this.calculateDependenciesScore(context);
    const environmentScore = this.calculateEnvironmentScore(context);
    const codeBlocksScore = this.calculateCodeBlocksScore();
    const githubScore = this.calculateGitHubScore(context.platform);

    const weightedScore = 
      (platformScore * this.weights.platform) +
      (filesScore * this.weights.files) +
      (dependenciesScore * this.weights.dependencies) +
      (environmentScore * this.weights.environment) +
      (codeBlocksScore * this.weights.codeBlocks) +
      (githubScore * this.weights.githubFeatures);

    return this.createScore(Math.round(weightedScore));
  }

  /**
   * Platform-based scoring (primary factor)
   */
  private calculatePlatformScore(platform: Platform): number {
    const platformScores: Record<Platform, number> = {
      'monaco': 100,
      'stackblitz': 95,
      'codesandbox': 95,
      'vscode-web': 90,
      'codemirror': 85,
      'github': 75,
      'gitlab': 70,
      'codepen': 60,
      'localhost': 50,
      'has-code': 40,
      'unknown': 25
    };

    return platformScores[platform];
  }

  /**
   * File structure scoring
   */
  private calculateFilesScore(context: CodeContext): number {
    const fileCount = context.structure.totalFiles;
    const lineCount = context.structure.totalLines;
    const entryPoints = context.structure.entryPoints.length;

    let score = 0;

    // File count scoring (diminishing returns)
    if (fileCount > 0) {
      score += Math.min(30, fileCount * 3);
    }

    // Line count scoring
    if (lineCount > 0) {
      score += Math.min(20, Math.floor(lineCount / 100));
    }

    // Entry points bonus
    if (entryPoints > 0) {
      score += Math.min(15, entryPoints * 5);
    }

    // File type diversity bonus
    const languages = new Set(context.structure.files.map(f => f.language));
    if (languages.size > 1) {
      score += Math.min(10, languages.size * 2);
    }

    return Math.min(100, score);
  }

  /**
   * Dependencies scoring
   */
  private calculateDependenciesScore(context: CodeContext): number {
    let score = 0;
    const deps = context.dependencies;

    // Runtime detection
    if (deps.runtime.language && deps.runtime.language !== 'unknown') {
      score += 30;
    }

    // Package count (with diminishing returns)
    if (deps.packages.length > 0) {
      score += Math.min(40, deps.packages.length * 2);
    }

    // Lock file presence
    if (deps.lockFile) {
      score += 20;
    }

    // Package manager detection
    if (deps.runtime.packageManager !== 'unknown') {
      score += 10;
    }

    return Math.min(100, score);
  }

  /**
   * Environment variables scoring
   */
  private calculateEnvironmentScore(context: CodeContext): number {
    let score = 0;
    const env = context.environment;

    // Environment variables count
    if (env.variables.length > 0) {
      score += Math.min(50, env.variables.length * 10);
    }

    // Config files presence
    if (env.configFiles.length > 0) {
      score += Math.min(30, env.configFiles.length * 5);
    }

    // Required vs optional variables
    const requiredVars = env.variables.filter(v => v.isRequired).length;
    if (requiredVars > 0) {
      score += Math.min(20, requiredVars * 5);
    }

    return Math.min(100, score);
  }

  /**
   * Code blocks scoring (for any page)
   */
  private calculateCodeBlocksScore(): number {
    const codeBlockCount = CodeBlockDetector.countCodeBlocks();
    const languages = CodeBlockDetector.getCodeLanguages();

    let score = 0;

    // Code block count
    if (codeBlockCount > 0) {
      score += Math.min(40, codeBlockCount * 5);
    }

    // Language diversity
    if (languages.length > 0) {
      score += Math.min(30, languages.length * 10);
    }

    // Syntax highlighting bonus
    const highlightedBlocks = document.querySelectorAll('.hljs, [class*="highlight"]').length;
    if (highlightedBlocks > 0) {
      score += Math.min(30, highlightedBlocks * 3);
    }

    return Math.min(100, score);
  }

  /**
   * GitHub-specific bonuses
   */
  private calculateGitHubScore(platform: Platform): number {
    if (platform !== 'github') {
      return 0;
    }

    const bonuses = GitHubDetector.getBonusFeatures();
    let score = 0;

    bonuses.forEach(feature => {
      switch (feature) {
        case 'package-json':
          score += 25;
          break;
        case 'env-file':
          score += 15;
          break;
        case 'readme':
          score += 10;
          break;
        case 'dockerfile':
          score += 15;
          break;
        case 'typescript':
          score += 10;
          break;
        case 'config-files':
          score += 10;
          break;
        default:
          score += 5;
      }
    });

    return Math.min(100, score);
  }

  /**
   * Create score with proper type safety
   */
  private createScore(value: number): Score {
    // Import the createScore function properly
    const clampedValue = Math.min(100, Math.max(0, Math.round(value)));
    return clampedValue as Score;
  }

  /**
   * Validate scoring weights sum to 1.0
   */
  private validateWeights(weights: ScoringWeights): ScoringWeights {
    const sum = Object.values(weights).reduce((total, weight) => total + weight, 0);
    const tolerance = 0.001;

    if (Math.abs(sum - 1.0) > tolerance) {
      throw new Error(`Scoring weights must sum to 1.0, got ${sum}`);
    }

    return weights;
  }

  /**
   * Get detailed scoring breakdown for debugging
   */
  getScoreBreakdown(context: CodeContext): {
    readonly total: Score;
    readonly breakdown: {
      readonly platform: number;
      readonly files: number;
      readonly dependencies: number;
      readonly environment: number;
      readonly codeBlocks: number;
      readonly github: number;
    };
  } {
    const platformScore = this.calculatePlatformScore(context.platform);
    const filesScore = this.calculateFilesScore(context);
    const dependenciesScore = this.calculateDependenciesScore(context);
    const environmentScore = this.calculateEnvironmentScore(context);
    const codeBlocksScore = this.calculateCodeBlocksScore();
    const githubScore = this.calculateGitHubScore(context.platform);

    const breakdown = {
      platform: platformScore * this.weights.platform,
      files: filesScore * this.weights.files,
      dependencies: dependenciesScore * this.weights.dependencies,
      environment: environmentScore * this.weights.environment,
      codeBlocks: codeBlocksScore * this.weights.codeBlocks,
      github: githubScore * this.weights.githubFeatures
    };

    const total = Object.values(breakdown).reduce((sum, score) => sum + score, 0);

    return {
      total: this.createScore(total),
      breakdown
    };
  }
}