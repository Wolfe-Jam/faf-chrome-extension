/**
 * Chrome Downloads API Wrapper for FAF Files
 */

import type { FAFFile, FileInfo } from '@/core/types';

export class DownloadsManager {
  /**
   * Generate a branded .faf file and download it to user-specified location
   */
  static async downloadFafFile(fafData: FAFFile, projectName: string | null = null): Promise<void> {
    const brandedContent = DownloadsManager.generateBrandedFafContent(fafData);
    const filename = DownloadsManager.generateFilename(fafData, projectName);

    try {
      // Create blob URL
      const blob = new Blob([brandedContent], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);

      // Trigger download via Chrome Downloads API with save dialog
      await chrome.downloads.download({
        url: url,
        filename: filename,
        saveAs: true, // Show save dialog for user to choose location
      });

      // Clean up blob URL
      setTimeout(() => URL.revokeObjectURL(url), 1000);

      console.log(`✅ FAF file downloaded: ${filename}`);
    } catch (error) {
      console.error('Failed to download FAF file:', error);
      throw new Error('Failed to save FAF file to Downloads');
    }
  }

  /**
   * Generate branded .faf file with human-readable header + full extraction data
   * Design: Dream Ticket - gorgeous human summary + complete AI-ready context
   */
  private static generateBrandedFafContent(fafData: FAFFile): string {
    const timestamp = new Date().toISOString().split('T')[0];
    const projectName = DownloadsManager.extractProjectName(fafData);
    const cleanUrl = DownloadsManager.cleanRepoUrl(fafData.context.metadata?.url || 'Unknown');
    const totalFiles = fafData.context.structure.files?.length || 0;
    const totalLines = fafData.context.structure?.totalLines || 0;
    const metadata = fafData.context.metadata || {};

    // Human-first summary at top - THE DREAM TICKET
    let humanSummary = `# ========================================
# STACK SUMMARY (Quick Reference)
# ========================================

Project: ${projectName}
Source: ${cleanUrl}
${metadata.description ? `About: ${metadata.description}` : ''}
${metadata.topics && metadata.topics.length > 0 ? `Stack: ${metadata.topics.join(', ')}` : ''}
${metadata.stars ? `Stars: ${metadata.stars}` : ''}${metadata.license ? ` | License: ${metadata.license}` : ''}
${metadata.languages && metadata.languages.length > 0 ? `Languages: ${metadata.languages.join(', ')}` : ''}
${metadata.lastUpdated ? `Last Updated: ${metadata.lastUpdated.split('T')[0]}` : ''}

Extracted: ${timestamp}
Files: ${totalFiles} | Lines: ${totalLines}

Quick Start:
  1. Drop this entire file into any AI conversation
  2. Or use: faf init (for complete project DNA with scoring)
  3. Start building!

Get FAF CLI: npm install -g faf-cli
More info: https://faf.one

# ========================================
# FULL EXTRACTION DATA (AI-Ready)
# ========================================

---
extraction:
  source: chrome-extension
  version: 1.0.5
  timestamp: "${timestamp}"

project:
  name: "${projectName}"
  source_url: "${cleanUrl}"

context:
  platform: "${fafData.context.platform || 'unknown'}"
  total_files: ${totalFiles}
  total_lines: ${totalLines}
  file_types: ${DownloadsManager.getUniqueLanguages(fafData.context.structure.files || [])}
  extraction_time: "${fafData.context.metadata?.extractionTime || 0}ms"

files:
${DownloadsManager.formatFilesForYaml(fafData.context.structure.files || [])}

structure:
  directories: ${JSON.stringify(fafData.context.structure?.directories || [])}
  entry_points: ${JSON.stringify(fafData.context.structure?.entryPoints || [])}

dependencies:
  runtime: "${fafData.context.dependencies?.runtime?.language || 'Unknown'}"
  package_manager: "${fafData.context.dependencies?.runtime?.packageManager || 'Unknown'}"
  packages: ${JSON.stringify(fafData.context.dependencies?.packages?.map((p) => p.name) || [])}

# End Chrome Extension Extraction
# Download = The Dream Ticket (Human + AI in one beautiful file)`;

    return humanSummary;
  }

  /**
   * Generate filename with optional project folder and timestamp
   */
  private static generateFilename(fafData: FAFFile, projectFolder: string | null = null): string {
    const timestamp = new Date().toISOString().split('T')[0];

    // If projectFolder is provided, use it for both folder AND filename
    if (projectFolder && projectFolder.trim()) {
      const safeFolderName = projectFolder.trim().replace(/[^a-zA-Z0-9-_]/g, '-');
      const filename = `${safeFolderName}_${timestamp}.faf.txt`;
      return `${safeFolderName}/${filename}`;
    }

    // Fallback: extract name from repo URL
    const extractedName = DownloadsManager.extractProjectName(fafData)
      .replace(/[^a-zA-Z0-9-_]/g, '_')
      .toLowerCase();

    const filename = `${extractedName}_${timestamp}.faf.txt`;
    return filename;
  }

  /**
   * Clean repo URL - strip releases, issues, tags, etc. to get clean repo URL
   */
  private static cleanRepoUrl(url: string): string {
    if (url === 'Unknown') return url;

    try {
      const urlObj = new URL(url);
      if (urlObj.hostname.includes('github.com')) {
        const pathParts = urlObj.pathname.split('/').filter(Boolean);
        // Get owner/repo only (first 2 parts)
        if (pathParts.length >= 2) {
          return `https://github.com/${pathParts[0]}/${pathParts[1]}`;
        }
      }
    } catch {
      return url;
    }

    return url;
  }

  /**
   * Extract project name from FAF data
   */
  private static extractProjectName(fafData: FAFFile): string {
    // Try to get project name from URL
    if (fafData.context.metadata?.url) {
      const url = new URL(fafData.context.metadata.url);
      if (url.hostname.includes('github.com')) {
        const pathParts = url.pathname.split('/').filter(Boolean);
        // Clean repo name from pathParts[1], regardless of page type (releases, issues, etc.)
        if (pathParts.length >= 2) {
          return pathParts[1] || 'unknown_project';
        }
      }
    }

    // Fallback to platform
    return `${fafData.context.platform || 'unknown'}_project`;
  }

  /**
   * Get unique programming languages from files
   */
  private static getUniqueLanguages(files: readonly FileInfo[]): string {
    const languages = new Set(files.map((f) => f.language).filter(Boolean));
    return JSON.stringify(Array.from(languages));
  }

  /**
   * Format files list for YAML output with content
   */
  private static formatFilesForYaml(files: readonly FileInfo[]): string {
    if (files.length === 0) return '  # No files extracted';

    return files
      .slice(0, 20)
      .map((file) => {
        const content = file.content ? `\n    content: |\n${file.content.split('\n').map(line => `      ${line}`).join('\n')}` : '';
        return `  - path: "${file.path}"
    language: "${file.language || 'unknown'}"
    lines: ${file.lines || 0}
    size: ${file.size || 0}${content}`;
      })
      .join('\n');
  }
}
