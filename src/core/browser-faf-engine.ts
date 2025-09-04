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
   */
  async scoreContext(context: CodeContext): Promise<Score> {
    // Convert Chrome extension context to FAF data format
    const fafData = this.contextToFafData(context);
    
    // Calculate score using the real ScoreCalculator
    const fafScore = this.scoreCalculator.calculate(fafData);
    
    // Convert score to Chrome extension format and return
    return createScore(fafScore.totalScore);
  }

  /**
   * Convert Chrome extension context to FAF data format
   */
  private contextToFafData(context: CodeContext): FafData {
    const projectName = this.inferProjectName(context);
    const mainLanguage = this.inferMainLanguage(context);
    
    // Build comprehensive FAF data structure
    const fafData: FafData = {
      project: {
        name: projectName,
        goal: `${context.platform} project with ${context.structure.totalFiles} files`,
        main_language: mainLanguage
      },
      stack: this.inferStack(context),
      human_context: {
        who: 'Chrome Extension User',
        what: `Working on ${projectName}`,
        why: 'AI context generation',
        where: context.platform,
        when: new Date().toISOString().split('T')[0],
        how: 'Chrome FAF Extension'
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
