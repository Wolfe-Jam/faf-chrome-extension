<script>
import { onMount } from 'svelte';
import { ChromeStorageAPI, ChromeTabs } from '@/adapters/chrome';
import { DownloadsManager } from '@/adapters/downloads';
import { telemetry } from '@/core/telemetry';

// State
let lastExtraction = null;
let isExtracting = false;
let error = null;
let projectName = '';

// Load stored extraction on mount
onMount(async () => {
  try {
    // Track popup opened
    telemetry.track('user_action', {
      action: 'popup_opened',
      timestamp: Date.now(),
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
      phase: 'load',
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
      timestamp: Date.now(),
    });

    const activeTab = await ChromeTabs.getActive();
    if (!activeTab?.id) {
      throw new Error('No active tab found');
    }

    // Championship-grade content script injection with readiness verification
    // MUST work first time, every time - no refresh required

    // Helper: Check if content script is ready
    async function isContentScriptReady(tabId) {
      try {
        const pingResponse = await chrome.tabs.sendMessage(tabId, {
          type: 'PING',
          timestamp: Date.now(),
          source: 'popup'
        });
        return pingResponse?.type === 'PONG';
      } catch {
        return false;
      }
    }

    // Step 1: Check if already loaded
    let scriptReady = await isContentScriptReady(activeTab.id);
    console.log('Content script ready check:', scriptReady);

    // Step 2: If not ready, inject and wait
    if (!scriptReady) {
      console.log('Injecting content script...');
      try {
        await chrome.scripting.executeScript({
          target: { tabId: activeTab.id },
          files: ['content.js'],
        });

        // Wait 1 second for script to fully initialize
        await new Promise((resolve) => setTimeout(resolve, 1000));

        // Verify it's now ready
        scriptReady = await isContentScriptReady(activeTab.id);
        console.log('After injection, script ready:', scriptReady);

        if (!scriptReady) {
          // One more try with longer delay
          console.log('Not ready yet, waiting longer...');
          await new Promise((resolve) => setTimeout(resolve, 1500));
          scriptReady = await isContentScriptReady(activeTab.id);
        }

      } catch (injectErr) {
        console.error('Content script injection failed:', injectErr);
        // Don't throw yet - let auto-refresh try to fix it
        scriptReady = false;
      }
    }

    // Step 3: If still not ready, auto-refresh the tab and retry
    if (!scriptReady) {
      console.log('Script not ready - auto-refreshing tab...');

      // Check if this is an unrecoverable page (chrome://, etc.)
      if (activeTab.url?.startsWith('chrome://') ||
          activeTab.url?.startsWith('chrome-extension://') ||
          activeTab.url?.startsWith('edge://') ||
          activeTab.url?.startsWith('about:')) {
        throw new Error('Cannot grab from browser pages. Try a GitHub repo or website.');
      }

      try {
        // Refresh the tab
        await chrome.tabs.reload(activeTab.id);

        // Wait for page to reload (3 seconds)
        await new Promise((resolve) => setTimeout(resolve, 3000));

        // Inject fresh
        await chrome.scripting.executeScript({
          target: { tabId: activeTab.id },
          files: ['content.js'],
        });

        // Wait for initialization
        await new Promise((resolve) => setTimeout(resolve, 1000));

        // Final check
        scriptReady = await isContentScriptReady(activeTab.id);

        if (!scriptReady) {
          // One final retry with longer wait
          console.log('Still not ready, one more try...');
          await new Promise((resolve) => setTimeout(resolve, 2000));
          scriptReady = await isContentScriptReady(activeTab.id);

          if (!scriptReady) {
            throw new Error('Page not responding. Try clicking GRAB again.');
          }
        }
      } catch (refreshErr) {
        console.error('Auto-refresh failed:', refreshErr);
        // Check if it's a permissions issue
        if (refreshErr.message?.includes('Cannot access')) {
          throw new Error('Cannot access this page. Try a public website.');
        }
        throw new Error('Auto-refresh failed. Try clicking GRAB again.');
      }
    }

    // Step 4: Send extraction message (script is confirmed ready)
    const message = {
      type: 'EXTRACT_CONTEXT',
      timestamp: Date.now(),
      source: 'popup',
    };

    let response;
    try {
      response = await chrome.tabs.sendMessage(activeTab.id, message);
    } catch (err) {
      console.error('Extraction message failed:', err);
      throw new Error('Extraction failed. Please try again.');
    }

    if (response?.success) {
      lastExtraction = response;

      // Store in local storage
      await ChromeStorageAPI.set({ lastExtraction: response });

      // Track success
      telemetry.track('extraction_complete', {
        platform: response.faf?.context?.platform || 'unknown',
        fileCount: response.faf?.context?.structure?.files?.length || 0,
        duration: Date.now() - performance.now(),
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
      phase: 'popup_extract',
    });
  } finally {
    isExtracting = false;
  }
}

// Copy to clipboard
async function handleCopy() {
  if (!lastExtraction?.success) return;

  try {
    // Use the same formatted content as Download (Dream Ticket format)
    const brandedContent = DownloadsManager.generateBrandedFafContent(lastExtraction.faf);
    await navigator.clipboard.writeText(brandedContent);

    // Track copy action
    telemetry.track('user_action', {
      action: 'copy_to_clipboard',
      size: brandedContent.length,
    });

    // Show temporary success message
    const originalText = document.querySelector('.copy-button')?.textContent;
    const button = document.querySelector('.copy-button');
    if (button) {
      button.textContent = '✓ Copied!';
      setTimeout(() => {
        button.textContent = originalText || '📋 Copy';
      }, 2000);
    }
  } catch (_err) {
    error = 'Failed to copy to clipboard';
  }
}

// Handle download action
async function handleDownload() {
  if (!lastExtraction?.faf) {
    error = 'No extraction data available. Try GRAB first.';
    return;
  }

  try {
    await DownloadsManager.downloadFafFile(lastExtraction.faf, projectName.trim() || null);

    // Track download action
    telemetry.track('user_action', {
      action: 'download_faf_file',
      platform: lastExtraction.faf.context?.platform,
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
    console.error('Download failed:', err);
    error = `Failed to download FAF file: ${err instanceof Error ? err.message : 'Unknown error'}`;
  }
}

// Format file size
function formatSize(bytes) {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

// Determine grab quality message
function getGrabMessage(extraction) {
  const files = extraction.faf.context.structure.files.length;
  const lines = extraction.faf.context.structure.totalLines;

  // Power Grab: multiple files (5+) OR lots of lines (1000+)
  if (files >= 5 || lines >= 1000) {
    return "⚡ Power Grab!";
  }

  // Standard Grab
  return "🟢 Ready!";
}
</script>

<div class="popup">
  <header>
    <div class="logo">
      <span class="emoji">⚡</span>
      <h1>Stack Grabber</h1>
    </div>
    <div class="tagline">The ColorZilla for stacks</div>
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
        <div class="extraction-summary">
          <div class="summary-header">{getGrabMessage(lastExtraction)}</div>
          <div class="summary-details">
            <div class="detail-item">
              <span class="label">Platform:</span>
              <span class="value">{lastExtraction.faf.context.platform}</span>
            </div>
            <div class="detail-item">
              <span class="label">Files:</span>
              <span class="value">{lastExtraction.faf.context.structure.files.length}</span>
            </div>
            <div class="detail-item">
              <span class="label">Lines:</span>
              <span class="value">{lastExtraction.faf.context.structure.totalLines}</span>
            </div>
          </div>
        </div>

        <div class="file-list">
          {#each lastExtraction.faf.context.structure.files.slice(0, 5) as file}
            <div class="file-item">
              <span class="file-name">{file.path}</span>
              <span class="file-size">{formatSize(file.size || 0)}</span>
            </div>
          {/each}
          {#if lastExtraction.faf.context.structure.files.length > 5}
            <div class="more-files">
              +{lastExtraction.faf.context.structure.files.length - 5} more files
            </div>
          {/if}
        </div>

        <div class="project-name-section">
          <label for="project-name">📁 Project name (optional):</label>
          <input
            type="text"
            id="project-name"
            bind:value={projectName}
            placeholder="my-awesome-project"
            class="project-name-input"
            on:keydown={(e) => e.key === 'Enter' && handleDownload()}
          />
          <div class="hint-text">Creates folder in Downloads (leave empty for direct download)</div>
        </div>

        <div class="action-buttons">
          <button class="copy-button" on:click={handleCopy}>
            📋 Copy
          </button>
          <button class="download-button" on:click={handleDownload}>
            ⬇️ Download
          </button>
        </div>
      </div>
    {:else if !error}
      <div class="empty-state">
        <div class="empty-icon">🚀</div>
        <p>Ready to grab this stack</p>
        <p class="hint">Click GRAB to instantly get the lowdown</p>
      </div>
    {/if}

    <button 
      class="extract-button {isExtracting ? 'extracting' : ''}"
      on:click={handleExtract}
      disabled={isExtracting}
    >
      {#if isExtracting}
        <span class="spinner">⟳</span>
        Grabbing...
      {:else}
        <span class="bolt">⚡</span>
        GRAB
      {/if}
    </button>
  </main>

  <footer>
    <a href="https://github.com/Wolfe-Jam/faf-chrome-extension" target="_blank">
      v1.6.0
    </a>
    <span class="separator">•</span>
    <span class="tagline-footer">Instantly get the lowdown</span>
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
    background: linear-gradient(135deg, #2c3e50 0%, #34495e 100%);
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

  .extraction-summary {
    background: #f9fafb;
    border-radius: 8px;
    padding: 16px;
    margin-bottom: 12px;
    border-left: 4px solid #2c3e50;
  }

  .summary-header {
    font-size: 16px;
    font-weight: 600;
    color: #1f2937;
    margin-bottom: 12px;
  }

  .summary-details {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .detail-item {
    display: flex;
    justify-content: space-between;
    font-size: 14px;
  }

  .label {
    color: #6b7280;
  }

  .value {
    font-weight: 500;
    color: #1f2937;
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

  .project-name-section {
    margin-bottom: 12px;
    padding: 12px;
    background: #f9fafb;
    border-radius: 8px;
  }

  .project-name-section label {
    display: block;
    font-size: 12px;
    font-weight: 500;
    color: #374151;
    margin-bottom: 6px;
  }

  .project-name-input {
    width: 100%;
    padding: 8px 12px;
    border: 1px solid #d1d5db;
    border-radius: 6px;
    font-size: 13px;
    font-family: monospace;
    box-sizing: border-box;
  }

  .project-name-input:focus {
    outline: none;
    border-color: #2c3e50;
    box-shadow: 0 0 0 3px rgba(44, 62, 80, 0.1);
  }

  .hint-text {
    margin-top: 4px;
    font-size: 11px;
    color: #9ca3af;
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
    background: linear-gradient(135deg, #2c3e50 0%, #34495e 100%);
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
