/**
 * Clipboard Operations - Type-safe clipboard management
 */

import type { FAFFile } from '@/core/types';

export class ClipboardError extends Error {
  constructor(
    message: string,
    public readonly code: 'PERMISSION_DENIED' | 'WRITE_FAILED' | 'FORMAT_ERROR'
  ) {
    super(message);
    this.name = 'ClipboardError';
  }
}

/**
 * Type-safe clipboard operations
 */
export class ClipboardManager {
  /**
   * Copy FAF content to clipboard in the standard .faf format
   */
  static async copyFAFContent(faf: FAFFile): Promise<void> {
    const content = this.formatFAFContent(faf);
    await this.writeToClipboard(content);
  }

  /**
   * Write text to clipboard with error handling
   */
  private static async writeToClipboard(text: string): Promise<void> {
    try {
      // Try modern Clipboard API first
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(text);
        return;
      }

      // Fallback to execCommand method
      this.execCommandFallback(text);
    } catch (error) {
      if (error instanceof Error && error.name === 'NotAllowedError') {
        throw new ClipboardError('Clipboard access denied', 'PERMISSION_DENIED');
      }
      throw new ClipboardError(
        error instanceof Error ? error.message : 'Failed to write to clipboard',
        'WRITE_FAILED'
      );
    }
  }

  /**
   * Fallback clipboard method using execCommand
   */
  private static execCommandFallback(text: string): void {
    const textarea = document.createElement('textarea');
    
    try {
      textarea.value = text;
      textarea.style.position = 'fixed';
      textarea.style.left = '-9999px';
      textarea.style.top = '-9999px';
      textarea.style.opacity = '0';
      textarea.setAttribute('readonly', '');
      
      document.body.appendChild(textarea);
      textarea.select();
      textarea.setSelectionRange(0, text.length);
      
      const success = document.execCommand('copy');
      if (!success) {
        throw new ClipboardError('execCommand copy failed', 'WRITE_FAILED');
      }
    } finally {
      if (textarea.parentNode) {
        textarea.parentNode.removeChild(textarea);
      }
    }
  }

  /**
   * Format FAF content according to specification
   */
  private static formatFAFContent(faf: FAFFile): string {
    const score = faf.score as number;
    const confidence = this.getConfidenceMessage(score);
    
    return `.faf Context
URL: ${faf.context.metadata.url}
Platform: ${faf.context.platform}
Score: ${score}%
Extracted: ${faf.generated}

Detection
Code blocks found: ${this.getCodeBlockCount(faf)}
Package.json detected: ${this.hasPackageJson(faf)}
Environment vars: ${this.hasEnvironmentVars(faf)}

AI Instructions
Context extracted from ${faf.context.platform} with ${score}% confidence.
${confidence}

## Summary
${faf.summary}

## Project Structure
Files: ${faf.context.structure.totalFiles}
Lines: ${faf.context.structure.totalLines}
Entry Points: ${faf.context.structure.entryPoints.join(', ') || 'None detected'}

## Dependencies
Runtime: ${faf.context.dependencies.runtime.language} ${faf.context.dependencies.runtime.version}
Package Manager: ${faf.context.dependencies.runtime.packageManager}
Packages: ${faf.context.dependencies.packages.length}

## Raw Context
${JSON.stringify(faf.context, null, 2)}`;
  }

  private static getConfidenceMessage(score: number): string {
    if (score >= 80) {
      return 'High confidence - Full project context available with complete file structure and dependencies.';
    }
    if (score >= 50) {
      return 'Medium confidence - Partial context available with basic project information.';
    }
    return 'Low confidence - Limited context available, basic page analysis only.';
  }

  private static getCodeBlockCount(faf: FAFFile): number {
    // Extract from context or calculate based on files
    return faf.context.structure.files.length > 0 
      ? faf.context.structure.files.length 
      : 0;
  }

  private static hasPackageJson(faf: FAFFile): boolean {
    return faf.context.dependencies.packages.length > 0 ||
           faf.context.structure.files.some(file => file.path.includes('package.json'));
  }

  private static hasEnvironmentVars(faf: FAFFile): boolean {
    return faf.context.environment.variables.length > 0 ||
           faf.context.environment.configFiles.some(file => file.includes('.env'));
  }

  /**
   * Validate clipboard content before copying
   */
  static validateFAFContent(faf: FAFFile): void {
    if (!faf.version) {
      throw new ClipboardError('Invalid FAF file: missing version', 'FORMAT_ERROR');
    }

    if (!faf.context) {
      throw new ClipboardError('Invalid FAF file: missing context', 'FORMAT_ERROR');
    }

    if (!faf.context.metadata?.url) {
      throw new ClipboardError('Invalid FAF file: missing URL', 'FORMAT_ERROR');
    }

    const score = faf.score as number;
    if (!Number.isInteger(score) || score < 0 || score > 100) {
      throw new ClipboardError('Invalid FAF file: invalid score', 'FORMAT_ERROR');
    }
  }

  /**
   * Get a preview of clipboard content (first 200 chars)
   */
  static getContentPreview(faf: FAFFile): string {
    const content = this.formatFAFContent(faf);
    return content.length > 200 ? `${content.substring(0, 200)}...` : content;
  }
}