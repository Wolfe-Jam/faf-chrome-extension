<script lang="ts">
  import type { ExtractionResult } from '@/core/types';
  import { getBadgeColors, getScoreValue } from '@/core/types';
  import { ChromeStorageAPI, ChromeTabs } from '@/adapters/chrome';
  import { DownloadsManager } from '@/adapters/downloads';
  import { telemetry } from '@/core/telemetry';
  import { onMount } from 'svelte';

  // State
  let lastExtraction: ExtractionResult | null = null;
  let isExtracting = false;
  let error: string | null = null;

  // Load stored extraction on mount
  onMount(async () => {
    try {
      // Track popup opened
      telemetry.track('user_action', {
        action: 'popup_opened',
        timestamp: Date.now()
      });

      const stored = await ChromeStorageAPI.get(['lastExtraction']);
      if (stored.lastExtraction) {
        lastExtraction = stored.lastExtraction;
      }
    } catch (err) {
      error = err instanceof Error ? err.message : 'Failed to load stored data';
      
      // Track popup error
      telemetry.track('error_boundary', {
        source: 'popup',
        error: error,
        phase: 'load'
      });
    }
  });

  // Handle extraction
  async function handleExtract() {
    if (isExtracting) return;

    isExtracting = true;
    error = null;

    try {
      // Track extraction attempt
      telemetry.track('user_action', {
        action: 'extract_clicked',
        timestamp: Date.now()
      });

      const activeTab = await ChromeTabs.getActiveTab();
      if (!activeTab?.id) {
        throw new Error('No active tab found');
      }

      // Send message to content script with proper message format
      const message = {
        type: 'EXTRACT_CONTEXT',
        timestamp: Date.now(),
        source: 'popup'
      };

      // Try to send message, and if it fails, inject the content script programmatically
      let response;
      try {
        response = await chrome.tabs.sendMessage(activeTab.id, message);
      } catch (err) {
        // Handle Chrome messaging errors by injecting content script
        if (err.message?.includes('Could not establish connection') || 
            err.message?.includes('Receiving end does not exist')) {
          
          console.log('Content script not ready, injecting programmatically...');
          
          // Inject the content script
          try {
            await chrome.scripting.executeScript({
              target: { tabId: activeTab.id },
              files: ['content.js']
            });
            
            // Wait a moment for script to initialize
            await new Promise(resolve => setTimeout(resolve, 500));
            
            // Try the message again
            response = await chrome.tabs.sendMessage(activeTab.id, message);
          } catch (injectError) {
            console.error('Failed to inject content script:', injectError);
            throw new Error('Unable to inject content script. Please refresh the page and try again.');
          }
        } else {
          throw err;
        }
      }

      if (response && response.success) {
        lastExtraction = response;
        
        // Store in local storage
        await ChromeStorageAPI.set({ lastExtraction: response });

        // Track success
        telemetry.track('extraction_complete', {
          platform: response.faf?.metadata?.platform || 'unknown',
          score: response.faf?.score || 0,
          fileCount: response.faf?.files?.length || 0,
          duration: Date.now() - performance.now()
        });
      } else {
        throw new Error(response?.error || 'Extraction failed - no response or invalid format');
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to extract context';
      error = errorMessage;

      // Track extraction error
      telemetry.track('extraction_error', {
        error: errorMessage,
        phase: 'popup_extract'
      });
    } finally {
      isExtracting = false;
    }
  }

  // Copy to clipboard
  async function handleCopy() {
    if (!lastExtraction?.success) return;

    try {
      const fafContent = JSON.stringify(lastExtraction.faf, null, 2);
      await navigator.clipboard.writeText(fafContent);

      // Track copy action
      telemetry.track('user_action', {
        action: 'copy_to_clipboard',
        size: fafContent.length
      });

      // Show temporary success message
      const originalText = document.querySelector('.copy-button')?.textContent;
      const button = document.querySelector('.copy-button');
      if (button) {
        button.textContent = '✓ Copied!';
        setTimeout(() => {
          button.textContent = originalText || 'Copy FAF';
        }, 2000);
      }
    } catch (err) {
      error = 'Failed to copy to clipboard';
    }
  }

  // Handle download action
  async function handleDownload() {
    if (!lastExtraction?.faf) return;

    try {
      await DownloadsManager.downloadFafFile(lastExtraction.faf);

      // Track download action
      telemetry.track('user_action', {
        action: 'download_faf_file',
        platform: lastExtraction.faf.metadata?.platform,
        score: lastExtraction.faf.score
      });

      // Show temporary success message
      const originalText = document.querySelector('.download-button')?.textContent;
      const button = document.querySelector('.download-button');
      if (button) {
        button.textContent = '✓ Downloaded!';
        setTimeout(() => {
          button.textContent = originalText || '⬇️ Download';
        }, 2000);
      }
    } catch (err) {
      error = 'Failed to download FAF file';
    }
  }

  // Format file size
  function formatSize(bytes: number): string {
    if (bytes < 1024) return `${bytes}B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
  }

  // Get score color
  function getScoreColor(score: number): string {
    if (score >= 90) return '#10b981'; // green-500
    if (score >= 70) return '#3b82f6'; // blue-500
    if (score >= 50) return '#f59e0b'; // amber-500
    return '#ef4444'; // red-500
  }
</script>

<div class="popup">
  <header>
    <div class="logo">
      <span class="emoji">⚡</span>
      <h1>FAF - Fast AF</h1>
    </div>
    <div class="tagline">Lightning-fast AI context extraction</div>
  </header>

  <main>
    {#if error}
      <div class="error">
        <span class="error-icon">⚠️</span>
        <span>{error}</span>
      </div>
    {/if}

    {#if lastExtraction?.success}
      <div class="extraction-result">
        <div class="score-section">
          <div class="score-badge" style="background: {getScoreColor(lastExtraction.faf.score.total)}">
            {lastExtraction.faf.score.total}%
          </div>
          <div class="score-details">
            <div class="platform">
              <span class="label">Platform:</span>
              <span class="value">{lastExtraction.faf.metadata.platform}</span>
            </div>
            <div class="files">
              <span class="label">Files:</span>
              <span class="value">{lastExtraction.faf.files.length}</span>
            </div>
          </div>
        </div>

        <div class="file-list">
          {#each lastExtraction.faf.files.slice(0, 5) as file}
            <div class="file-item">
              <span class="file-name">{file.path}</span>
              <span class="file-size">{formatSize(file.content.length)}</span>
            </div>
          {/each}
          {#if lastExtraction.faf.files.length > 5}
            <div class="more-files">
              +{lastExtraction.faf.files.length - 5} more files
            </div>
          {/if}
        </div>

        <div class="action-buttons">
          <button class="copy-button" on:click={handleCopy}>
            📋 Copy FAF
          </button>
          <button class="download-button" on:click={handleDownload}>
            ⬇️ Download
          </button>
        </div>
      </div>
    {:else if !error}
      <div class="empty-state">
        <div class="empty-icon">🚀</div>
        <p>Ready to extract context</p>
        <p class="hint">Click below to analyze this page's code and content</p>
      </div>
    {/if}

    <button 
      class="extract-button {isExtracting ? 'extracting' : ''}"
      on:click={handleExtract}
      disabled={isExtracting}
    >
      {#if isExtracting}
        <span class="spinner">⟳</span>
        Extracting...
      {:else}
        <span class="bolt">⚡</span>
        Extract AI Context
      {/if}
    </button>
  </main>

  <footer>
    <a href="https://github.com/Wolfe-Jam/faf-chrome-extension" target="_blank">
      v1.0.0
    </a>
    <span class="separator">•</span>
    <span class="tagline-footer">Fast AI Context</span>
  </footer>
</div>

<style>
  .popup {
    width: 400px;
    min-height: 300px;
    font-family: system-ui, -apple-system, sans-serif;
    background: #ffffff;
    color: #1f2937;
  }

  header {
    padding: 16px;
    background: linear-gradient(135deg, #1e40af 0%, #7c3aed 100%);
    color: white;
  }

  .logo {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 4px;
  }

  .logo .emoji {
    font-size: 24px;
  }

  .logo h1 {
    margin: 0;
    font-size: 20px;
    font-weight: 700;
  }

  .tagline {
    font-size: 12px;
    opacity: 0.9;
  }

  main {
    padding: 16px;
  }

  .error {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 12px;
    background: #fee2e2;
    color: #dc2626;
    border-radius: 8px;
    margin-bottom: 12px;
    font-size: 14px;
  }

  .extraction-result {
    margin-bottom: 16px;
  }

  .score-section {
    display: flex;
    align-items: center;
    gap: 16px;
    margin-bottom: 16px;
  }

  .score-badge {
    width: 60px;
    height: 60px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    color: white;
    font-size: 20px;
    font-weight: bold;
  }

  .score-details {
    flex: 1;
  }

  .platform, .files {
    display: flex;
    justify-content: space-between;
    margin-bottom: 4px;
    font-size: 14px;
  }

  .label {
    color: #6b7280;
  }

  .value {
    font-weight: 500;
  }

  .file-list {
    background: #f9fafb;
    border-radius: 8px;
    padding: 12px;
    margin-bottom: 12px;
    max-height: 150px;
    overflow-y: auto;
  }

  .file-item {
    display: flex;
    justify-content: space-between;
    padding: 4px 0;
    font-size: 13px;
  }

  .file-name {
    color: #4b5563;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    flex: 1;
  }

  .file-size {
    color: #9ca3af;
    margin-left: 8px;
  }

  .more-files {
    padding-top: 8px;
    font-size: 12px;
    color: #6b7280;
    text-align: center;
  }

  .empty-state {
    text-align: center;
    padding: 32px 16px;
  }

  .empty-icon {
    font-size: 48px;
    margin-bottom: 12px;
  }

  .empty-state p {
    margin: 4px 0;
    color: #6b7280;
  }

  .hint {
    font-size: 13px;
    color: #9ca3af;
  }

  .extract-button, .copy-button {
    width: 100%;
    padding: 12px;
    border: none;
    border-radius: 8px;
    font-size: 14px;
    font-weight: 500;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    transition: all 0.2s;
  }

  .extract-button {
    background: linear-gradient(135deg, #1e40af 0%, #7c3aed 100%);
    color: white;
  }

  .extract-button:hover:not(:disabled) {
    transform: translateY(-1px);
    box-shadow: 0 4px 12px rgba(30, 64, 175, 0.4);
  }

  .extract-button:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .extract-button.extracting .spinner {
    animation: spin 1s linear infinite;
  }

  @keyframes spin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }

  .copy-button {
    background: #f3f4f6;
    color: #374151;
    margin-bottom: 12px;
  }

  .action-buttons {
    display: flex;
    gap: 8px;
    margin-top: 12px;
  }

  .copy-button, .download-button {
    flex: 1;
    font-size: 11px;
    font-weight: 500;
  }

  .copy-button:hover {
    background: #e5e7eb;
  }

  .download-button {
    padding: 8px 12px;
    border: 1px solid #d1d5db;
    border-radius: 6px;
    background: #22c55e;
    color: white;
    cursor: pointer;
    font-size: 11px;
    font-weight: 500;
    transition: background-color 0.2s;
  }

  .download-button:hover {
    background: #16a34a;
  }

  .download-button:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  footer {
    padding: 12px 16px;
    border-top: 1px solid #e5e7eb;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    font-size: 12px;
    color: #6b7280;
  }

  footer a {
    color: #6b7280;
    text-decoration: none;
  }

  footer a:hover {
    color: #1e40af;
  }

  .separator {
    color: #d1d5db;
  }

  .tagline-footer {
    font-style: italic;
  }
</style>