/**
 * Chrome Downloads API Wrapper for FAF Files
 */

import type { FAFFile } from '@/core/types';

export class DownloadsManager {
  /**
   * Generate a branded .faf file and download it to Downloads folder
   */
  static async downloadFafFile(fafData: FAFFile): Promise<void> {
    const brandedContent = this.generateBrandedFafContent(fafData);
    const filename = this.generateFilename(fafData);
    
    try {
      // Create blob URL
      const blob = new Blob([brandedContent], { type: 'text/yaml' });
      const url = URL.createObjectURL(blob);
      
      // Trigger download via Chrome Downloads API
      await chrome.downloads.download({
        url: url,
        filename: filename,
        saveAs: false // Auto-save to Downloads
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
   * Generate branded FAF content with marketing links
   */
  private static generateBrandedFafContent(fafData: FAFFile): string {
    const timestamp = new Date().toISOString().split('T')[0];
    const projectName = this.extractProjectName(fafData);
    const score = fafData.score || 0;
    
    return `# 🚀 FAF (Fast AF ⚡️ AI-Context) - ${projectName}
# Generated on ${timestamp} | Score: ${score}%
# 
# 🏎️ Powered by faf-engine Mk-1 - Real Intelligence, No Fakes!
# ⚡️ Get FAF Chrome Extension: https://chrome.google.com/webstore (search "FAF")
# 🌐 Learn more: https://faf.one
# 💬 Join the revolution: Stop faffing about with manual context!
#
# 📋 Share this .faf file with your AI assistants for instant project context
# 🎯 Spread the word: FAF = The Universal AI Context Standard
#
# Created by 🏎️⚡️WolfeJam - Production-Quality AI Tools

---
project:
  name: "${projectName}"
  description: "AI Context extracted by FAF Chrome Extension"
  goal: "Perfect context for AI assistance"
  source_url: "${fafData.metadata?.url || 'Unknown'}"
  extraction_date: "${timestamp}"
  faf_version: "${fafData.metadata?.version || '1.0.1'}"
  intelligence_score: "${score}%"

# 🎯 REAL ANALYSIS RESULTS (Not Fake Scores!)
context:
  platform: "${fafData.metadata?.platform || 'unknown'}"
  total_files: ${fafData.files?.length || 0}
  file_types: ${this.getUniqueLanguages(fafData.files || [])}
  extraction_time: "${fafData.metadata?.extractionTime || 0}ms"
  
# 📁 FILE STRUCTURE
files:
${this.formatFilesForYaml(fafData.files || [])}

# 🏗️ PROJECT STRUCTURE  
structure:
  directories: ${JSON.stringify(fafData.structure?.directories || [])}
  entry_points: ${JSON.stringify(fafData.structure?.entryPoints || [])}
  total_lines: ${fafData.structure?.totalLines || 0}

# 📦 DEPENDENCIES (If Detected)
dependencies:
  runtime: "${fafData.dependencies?.runtime?.language || 'Unknown'}"
  package_manager: "${fafData.dependencies?.runtime?.packageManager || 'Unknown'}"
  packages: ${JSON.stringify(fafData.dependencies?.packages?.map(p => p.name) || [])}

# 🌐 METADATA
metadata:
  user_agent: "${fafData.metadata?.userAgent || 'Unknown'}"
  timestamp: "${fafData.metadata?.timestamp || new Date().toISOString()}"
  faf_engine: "faf-engine Mk-1"
  extraction_method: "Chrome Extension with Real Intelligence"

# 🚀 GET FAF FOR YOUR TEAM
# Chrome Extension: https://chrome.google.com/webstore (search "FAF") 
# Website: https://faf.one
# Created by: 🏎️⚡️WolfeJam
#
# 💡 Why FAF?
# ✅ Real faf-engine Mk-1 analysis (not fake scores!)
# ✅ Universal AI context standard
# ✅ One-click extraction from any codebase
# ✅ Perfect for ChatGPT, Claude, Gemini, etc.
# ✅ Share .faf files for instant project context
#
# 🎯 Stop faffing about - Get perfect AI context instantly!

---
# End of FAF Context File
# Share this with your AI assistant for instant project understanding
# Get FAF: https://faf.one | 🏎️⚡️WolfeJam`;
  }

  /**
   * Generate filename with project name and timestamp
   */
  private static generateFilename(fafData: FAFFile): string {
    const projectName = this.extractProjectName(fafData)
      .replace(/[^a-zA-Z0-9-_]/g, '_') // Safe filename
      .toLowerCase();
    
    const timestamp = new Date().toISOString().split('T')[0];
    const score = fafData.score || 0;
    
    return `${projectName}_${timestamp}_${score}percent.faf`;
  }

  /**
   * Extract project name from FAF data
   */
  private static extractProjectName(fafData: FAFFile): string {
    // Try to get project name from URL
    if (fafData.metadata?.url) {
      const url = new URL(fafData.metadata.url);
      if (url.hostname.includes('github.com')) {
        const pathParts = url.pathname.split('/').filter(Boolean);
        if (pathParts.length >= 2) {
          return pathParts[1]; // repo name
        }
      }
    }
    
    // Fallback to platform
    return `${fafData.metadata?.platform || 'unknown'}_project`;
  }

  /**
   * Get unique programming languages from files
   */
  private static getUniqueLanguages(files: any[]): string {
    const languages = new Set(files.map(f => f.language).filter(Boolean));
    return JSON.stringify(Array.from(languages));
  }

  /**
   * Format files list for YAML output
   */
  private static formatFilesForYaml(files: any[]): string {
    if (files.length === 0) return '  # No files extracted';
    
    return files.slice(0, 20).map(file => // Limit to first 20 files
      `  - path: "${file.path}"
    language: "${file.language || 'unknown'}"
    lines: ${file.lines || 0}
    size: ${file.size || 0}`
    ).join('\n');
  }
}