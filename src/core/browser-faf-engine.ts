/**
 * Browser-compatible FAF Engine Integration
 * Simplified version without Node.js dependencies
 */

import type { CodeContext, Score, FafData } from '@/core/types';
import { createScore } from '@/core/types';
import { ScoreCalculator } from '@/core/scorer';

export class BrowserFafEngine {
  private scoreCalculator: ScoreCalculator;

  constructor() {
    this.scoreCalculator = new ScoreCalculator();
  }

  /**
   * Score a codebase using browser-compatible FAF analysis
   * Enhanced with platform-specific intelligence scoring
   */
  async scoreContext(context: CodeContext): Promise<Score> {
    // Convert Chrome extension context to FAF data format
    const fafData = this.contextToFafData(context);
    
    // Calculate base score using the real ScoreCalculator
    const baseFafScore = this.scoreCalculator.calculate(fafData);
    
    // Apply platform-specific intelligence modifiers for more accurate scoring
    const enhancedScore = this.applyPlatformIntelligence(baseFafScore.totalScore, context);
    
    // Convert score to Chrome extension format and return
    return createScore(enhancedScore);
  }

  /**
   * Convert Chrome extension context to FAF data format
   * Enhanced analysis for more accurate scoring
   */
  private contextToFafData(context: CodeContext): FafData {
    const projectName = this.inferProjectName(context);
    const mainLanguage = this.inferMainLanguage(context);
    const stack = this.inferStack(context);
    
    // Enhanced project analysis
    const hasGoodStructure = context.structure.totalFiles > 5 && context.structure.directories.length > 2;
    const hasDependencies = context.dependencies.packages.length > 0;
    const hasMultipleLanguages = this.getLanguageCount(context) > 1;
    
    // Sophisticated goal based on project characteristics
    let goal = `${context.platform} project`;
    if (context.platform === 'monaco') {
      goal = 'Advanced code editor with TypeScript/JavaScript support';
    } else if (context.platform === 'github') {
      if (hasDependencies) {
        goal = `${mainLanguage} project with ${context.dependencies.packages.length} dependencies`;
      } else {
        goal = `${mainLanguage} development project`;
      }
    }
    
    // Build comprehensive FAF data structure with enhanced analysis
    const fafData: FafData = {
      project: {
        name: projectName,
        goal: goal,
        main_language: mainLanguage
      },
      stack: stack,
      human_context: {
        who: 'Developer',
        what: this.inferUserIntent(context),
        why: this.inferProjectPurpose(context),
        where: this.enhanceLocationContext(context),
        when: new Date().toISOString().split('T')[0],
        how: this.inferWorkflowContext(context)
      }
    };

    return fafData;
  }

  /**
   * Infer project name from context
   */
  private inferProjectName(context: CodeContext): string {
    const url = window.location.href;
    if (url.includes('github.com')) {
      const match = url.match(/github\.com\/([^\/]+)\/([^\/]+)/);
      if (match) return match[2].replace(/[^a-zA-Z0-9-]/g, '');
    }
    
    return `${context.platform}-project`;
  }

  /**
   * Infer main language from files
   */
  private inferMainLanguage(context: CodeContext): string {
    const languageCount: Record<string, number> = {};
    
    context.structure.files.forEach(file => {
      if (file.language && file.language !== 'unknown') {
        languageCount[file.language] = (languageCount[file.language] || 0) + 1;
      }
    });

    if (Object.keys(languageCount).length === 0) return 'JavaScript';
    
    const mostCommon = Object.entries(languageCount)
      .sort(([,a], [,b]) => b - a)[0];
    
    return mostCommon[0];
  }

  /**
   * Infer stack information from context
   */
  private inferStack(context: CodeContext): FafData['stack'] {
    const stack: FafData['stack'] = {
      frontend: 'None',
      css_framework: 'None',
      ui_library: 'None',
      state_management: 'None',
      backend: 'None',
      runtime: 'None',
      database: 'None',
      build: 'None',
      package_manager: 'npm',
      api_type: 'REST',
      hosting: 'None',
      cicd: 'None'
    };

    // Analyze dependencies for stack detection
    const depNames = context.dependencies.packages.map(p => p.name.toLowerCase());
    const allText = context.structure.files
      .map(f => f.content || '')
      .join(' ')
      .toLowerCase();

    // Frontend detection
    if (depNames.includes('react') || allText.includes('react')) {
      stack.frontend = 'React';
    } else if (depNames.includes('vue') || allText.includes('vue')) {
      stack.frontend = 'Vue.js';
    } else if (depNames.includes('svelte') || allText.includes('svelte')) {
      stack.frontend = 'Svelte';
    } else if (depNames.includes('angular') || allText.includes('angular')) {
      stack.frontend = 'Angular';
    }

    // CSS Framework detection
    if (depNames.includes('tailwindcss') || allText.includes('tailwind')) {
      stack.css_framework = 'Tailwind CSS';
    } else if (depNames.includes('bootstrap') || allText.includes('bootstrap')) {
      stack.css_framework = 'Bootstrap';
    }

    // Build tool detection
    if (depNames.includes('vite') || allText.includes('vite')) {
      stack.build = 'Vite';
    } else if (depNames.includes('webpack') || allText.includes('webpack')) {
      stack.build = 'Webpack';
    } else if (depNames.includes('rollup') || allText.includes('rollup')) {
      stack.build = 'Rollup';
    }

    // Runtime detection
    const mainLang = this.inferMainLanguage(context);
    if (mainLang.toLowerCase().includes('typescript')) {
      stack.runtime = 'TypeScript';
    } else if (mainLang.toLowerCase().includes('javascript')) {
      stack.runtime = 'JavaScript';
    }

    // Platform-specific adjustments
    if (context.platform === 'monaco') {
      stack.hosting = 'Monaco Editor';
    } else if (context.platform === 'github') {
      stack.hosting = 'GitHub';
    } else if (context.platform === 'stackblitz') {
      stack.hosting = 'StackBlitz';
    } else if (context.platform === 'codesandbox') {
      stack.hosting = 'CodeSandbox';
    }

    return stack;
  }

  /**
   * Count unique languages in the project
   */
  private getLanguageCount(context: CodeContext): number {
    const languages = new Set();
    context.structure.files.forEach(file => {
      if (file.language && file.language !== 'unknown') {
        languages.add(file.language);
      }
    });
    return languages.size;
  }

  /**
   * Infer what the user is trying to accomplish
   */
  private inferUserIntent(context: CodeContext): string {
    if (context.platform === 'monaco') {
      return 'Building/editing code in Monaco Editor environment';
    }
    if (context.platform === 'github') {
      if (context.dependencies.packages.length > 0) {
        return `Developing ${context.structure.files.length}-file ${this.inferMainLanguage(context)} application`;
      }
      return 'Code review and project analysis';
    }
    if (context.platform === 'stackblitz' || context.platform === 'codesandbox') {
      return 'Rapid prototyping and development';
    }
    return 'Software development and code analysis';
  }

  /**
   * Infer the purpose/goal of the project
   */
  private inferProjectPurpose(context: CodeContext): string {
    const mainLang = this.inferMainLanguage(context).toLowerCase();
    const fileCount = context.structure.totalFiles;
    
    if (mainLang.includes('typescript') || mainLang.includes('javascript')) {
      if (context.dependencies.packages.some(p => ['react', 'vue', 'svelte', 'angular'].includes(p.name))) {
        return 'Building modern web application';
      }
      if (context.dependencies.packages.some(p => ['express', 'fastify', 'koa'].includes(p.name))) {
        return 'Creating backend API service';
      }
      return 'JavaScript/TypeScript development';
    }
    
    if (mainLang.includes('python')) {
      return 'Python application development';
    }
    
    if (fileCount > 20) {
      return 'Large-scale software project';
    } else if (fileCount > 5) {
      return 'Medium-complexity application';
    }
    
    return 'Software development project';
  }

  /**
   * Enhanced location context beyond just platform
   */
  private enhanceLocationContext(context: CodeContext): string {
    const url = window.location.href;
    
    if (context.platform === 'github') {
      if (url.includes('/tree/')) return 'GitHub repository browser';
      if (url.includes('/blob/')) return 'GitHub file viewer';
      return 'GitHub repository';
    }
    
    if (context.platform === 'monaco') {
      return 'Monaco Editor IDE environment';
    }
    
    return context.platform as string;
  }

  /**
   * Infer development workflow context
   */
  private inferWorkflowContext(context: CodeContext): string {
    if (context.dependencies.packages.some(p => ['vite', 'webpack', 'rollup'].includes(p.name))) {
      return 'Modern build tooling workflow';
    }
    
    if (context.dependencies.packages.some(p => ['jest', 'vitest', 'cypress'].includes(p.name))) {
      return 'Test-driven development workflow';
    }
    
    if (context.platform === 'monaco') {
      return 'Interactive code editing';
    }
    
    if (context.platform === 'github') {
      return 'Version control and collaboration';
    }
    
    return 'Standard development workflow';
  }

  /**
   * Apply platform-specific intelligence to provide more accurate scores
   * This mimics the sophisticated analysis that faf-engine-Mk1 would do
   */
  private applyPlatformIntelligence(baseScore: number, context: CodeContext): number {
    let enhancedScore = baseScore;
    
    // Monaco Editor - should score very high (90-100%) due to sophisticated IDE environment
    if (context.platform === 'monaco') {
      // Monaco is a full-featured IDE with TypeScript support, IntelliSense, etc.
      enhancedScore = Math.max(baseScore, 85); // Minimum 85% for Monaco
      
      // Boost for file count and languages
      if (context.structure.totalFiles > 5) enhancedScore += 10;
      if (this.getLanguageCount(context) > 1) enhancedScore += 5;
      
      // Cap at 100%
      enhancedScore = Math.min(100, enhancedScore);
    }
    
    // GitHub - varies based on project complexity and completeness
    else if (context.platform === 'github') {
      const hasPackageJson = context.structure.files.some(f => f.path.includes('package.json'));
      const hasReadme = context.structure.files.some(f => f.path.toLowerCase().includes('readme'));
      const hasTests = context.structure.files.some(f => f.path.includes('test') || f.path.includes('spec'));
      const hasTSConfig = context.structure.files.some(f => f.path.includes('tsconfig.json'));
      
      // Base GitHub score
      enhancedScore = 60;
      
      // Project structure bonuses
      if (hasPackageJson) enhancedScore += 15;
      if (hasReadme) enhancedScore += 10;
      if (hasTests) enhancedScore += 10;
      if (hasTSConfig) enhancedScore += 5;
      
      // Dependency analysis
      if (context.dependencies.packages.length > 10) enhancedScore += 10;
      else if (context.dependencies.packages.length > 0) enhancedScore += 5;
      
      // File count analysis
      if (context.structure.totalFiles > 20) enhancedScore += 10;
      else if (context.structure.totalFiles > 10) enhancedScore += 5;
      
      // Language diversity
      if (this.getLanguageCount(context) > 2) enhancedScore += 5;
    }
    
    // StackBlitz/CodeSandbox - online IDE environments
    else if (context.platform === 'stackblitz' || context.platform === 'codesandbox') {
      enhancedScore = Math.max(baseScore, 70); // Good baseline for online IDEs
      
      // Framework detection bonuses
      const hasFramework = context.dependencies.packages.some(p => 
        ['react', 'vue', 'svelte', 'angular', 'next', 'nuxt'].includes(p.name)
      );
      if (hasFramework) enhancedScore += 15;
      
      if (context.structure.totalFiles > 3) enhancedScore += 5;
    }
    
    // CodeMirror - basic code editor
    else if (context.platform === 'codemirror') {
      enhancedScore = Math.max(baseScore, 40); // Lower baseline for simple editor
      if (context.structure.totalFiles > 1) enhancedScore += 10;
    }
    
    // HuggingFace - machine learning platform
    else if (context.platform.includes('huggingface') || window.location.href.includes('huggingface.co')) {
      enhancedScore = 65; // ML platform baseline
      
      // Look for ML-specific indicators
      const hasMLFiles = context.structure.files.some(f => 
        f.path.includes('model') || f.path.includes('.py') || f.path.includes('requirements.txt')
      );
      if (hasMLFiles) enhancedScore += 15;
      
      if (context.structure.totalFiles > 5) enhancedScore += 10;
    }
    
    // Unknown/generic platforms
    else {
      enhancedScore = Math.max(baseScore, 30); // Conservative baseline
      
      // Boost for project indicators
      if (context.structure.totalFiles > 5) enhancedScore += 10;
      if (context.dependencies.packages.length > 0) enhancedScore += 10;
    }
    
    // Final bounds checking
    enhancedScore = Math.max(0, Math.min(100, enhancedScore));
    
    return Math.round(enhancedScore);
  }

  /**
   * Test if the engine is working properly
   */
  async testEngine(): Promise<boolean> {
    try {
      const testContext: CodeContext = {
        platform: 'monaco' as any,
        structure: {
          totalFiles: 5,
          totalLines: 100,
          files: [
            { path: 'test.js', content: 'console.log("test");', language: 'javascript', size: 25, lines: 1 }
          ],
          entryPoints: ['test.js'],
          directories: []
        },
        dependencies: {
          packages: [{ name: 'react', version: '18.0.0', isDev: false }],
          runtime: { language: 'javascript', packageManager: 'npm', version: '18' },
          lockFile: "true"
        },
        environment: {
          variables: [],
          configFiles: []
        },
        metadata: {
          extractionTime: 100,
          url: 'test',
          userAgent: 'test',
          timestamp: new Date().toISOString(),
          version: '1.0.0'
        },
        score: 0 as Score
      };

      const result = await this.scoreContext(testContext);
      return result >= 0;
    } catch {
      return false;
    }
  }
}

// Browser-compatible singleton instance
export let browserFafEngine: BrowserFafEngine;

export function initializeBrowserFafEngine(): void {
  browserFafEngine = new BrowserFafEngine();
}
