<script>
  import { onMount } from 'svelte';
  import { ChromeTabs, ChromeStorageAPI } from '../adapters/chrome';
  import { telemetry } from '../core/telemetry';
  import { ClipboardManager } from '../adapters/clipboard';

  let extraction = null;
  let isExtracting = false;
  let error = null;

  onMount(async () => {
    console.log('FAF Popup mounted with Svelte!');

    const pingServiceWorker = async (retries = 5, delay = 100) => {
      for (let i = 0; i < retries; i++) {
        try {
          const response = await chrome.runtime.sendMessage({ type: 'PING', source: 'popup', timestamp: Date.now() });
          if (response && response.type === 'PONG') {
            console.log('FAF Service Worker is active.');
            return true;
          }
        } catch (e) {
          console.error('FAF Popup: Ping attempt failed.', e);
          if (i < retries - 1) {
            console.warn(`FAF Ping failed (attempt ${i + 1}), retrying in ${delay}ms...`);
            await new Promise(resolve => setTimeout(resolve, delay));
          } else {
            console.error('FAF Service worker did not respond after multiple retries.', e);
            return false;
          }
        }
      }
      return false;
    };

    try {
      const isServiceWorkerActive = await pingServiceWorker();
      if (isServiceWorkerActive) {
        error = null; // Clear any previous error
        const stored = await ChromeStorageAPI.get(['lastExtraction']);
        if (stored.lastExtraction) {
          extraction = stored.lastExtraction;
        }
      } else {
        error = "Could not connect to FAF background service. Please try reloading the extension.";
      }
    } catch (err) {
      console.warn('Failed to load stored data:', err);
      error = "An error occurred while loading initial data.";
    }
  });

  async function handleExtract() {
    if (isExtracting) return;

    isExtracting = true;
    error = null;

    try {
      // Track extraction attempt
      await telemetry.track('user_action', {
        action: 'extract_clicked',
        timestamp: Date.now()
      });

      const activeTab = await ChromeTabs.getActive();
      if (!activeTab?.id) {
        throw new Error('No active tab found');
      }

      console.log('Sending message to content script on tab:', activeTab.id);

      // Send message to content script for real extraction
      const response = await chrome.tabs.sendMessage(activeTab.id, { 
        type: 'EXTRACT_CONTEXT',
        timestamp: Date.now(),
        source: 'popup'
      });

      console.log('Got response:', response);

      if (response?.success) {
        extraction = response;
        
        // Store the extraction
        await ChromeStorageAPI.set({ lastExtraction: response });

        // Track success
        await telemetry.track('extraction_complete', {
          platform: response.faf.metadata.platform,
          score: response.faf.score.total,
          fileCount: response.faf.files.length
        });
      } else {
        throw new Error(response?.error || 'Extraction failed - no response from content script');
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to extract context';
      error = errorMessage;
      console.error('Extraction error:', err);

      // Track extraction error
      await telemetry.track('extraction_error', {
        error: errorMessage,
        phase: 'popup_extract'
      });
    } finally {
      isExtracting = false;
    }
  }

  async function handleCopy() {
    if (!extraction?.success) return;

    try {
      // Use ClipboardManager for better compatibility
      await ClipboardManager.copyFAFContent(extraction.faf);
      
      await telemetry.track('user_action', {
        action: 'copy_to_clipboard',
        score: extraction.faf.score
      });

      // Visual feedback
      const button = document.querySelector('.copy-button');
      if (button) {
        const originalText = button.textContent;
        button.textContent = '✓ Copied!';
        setTimeout(() => {
          button.textContent = originalText;
        }, 2000);
      }
    } catch (err) {
      error = 'Failed to copy to clipboard';
    }
  }

  // Helper functions for formatting
  function getScoreColor(score) {
    if (score >= 90) return '#10b981'; // green
    if (score >= 70) return '#3b82f6'; // blue  
    if (score >= 50) return '#f59e0b'; // amber
    return '#ef4444'; // red
  }

  function formatSize(bytes) {
    if (bytes < 1024) return `${bytes}B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
  }

  function formatTotalSize(files) {
    const total = files.reduce((sum, file) => sum + file.content.length, 0);
    return formatSize(total);
  }
</script>

<div class="popup">
  <header>
    <div class="logo">
      <span>⚡</span>
      <h1>FAF - Fast AF</h1>
    </div>
    <div class="tagline">Extract perfect AI context in 0.3s</div>
  </header>

  <main>
    {#if error}
      <div class="error">
        <span>⚠️</span>
        <span>{error}</span>
      </div>
    {/if}

    {#if extraction?.success}
      <div class="result">
        <div class="score-section">
          <div class="score-badge" style="background: {getScoreColor(extraction.faf.score.total)}">
            {extraction.faf.score.total}%
          </div>
          <div class="details">
            <div><strong>Platform:</strong> {extraction.faf.metadata.platform}</div>
            <div><strong>Files:</strong> {extraction.faf.files.length}</div>
            <div><strong>Size:</strong> {formatTotalSize(extraction.faf.files)}</div>
          </div>
        </div>

        {#if extraction.faf.files.length > 0}
          <div class="files-preview">
            <div class="files-header">Files extracted:</div>
            {#each extraction.faf.files.slice(0, 3) as file}
              <div class="file-item">
                <span class="file-path">{file.path}</span>
                <span class="file-size">{formatSize(file.content.length)}</span>
              </div>
            {/each}
            {#if extraction.faf.files.length > 3}
              <div class="more-files">+{extraction.faf.files.length - 3} more files</div>
            {/if}
          </div>
        {/if}

        <button class="copy-button" on:click={handleCopy}>
          Copy FAF to Clipboard
        </button>
      </div>
    {:else if !isExtracting}
      <div class="empty-state">
        <div class="empty-icon">📄</div>
        <p>Ready to extract context</p>
        <p class="hint">Click extract to analyze the current page</p>
      </div>
    {/if}

    <button class="extract-button" on:click={handleExtract} disabled={isExtracting}>
      {#if isExtracting}
        <span class="spinner">⟳</span>
        Extracting...
      {:else}
        <span>⚡</span>
        Extract Context
      {/if}
    </button>
  </main>

  <footer>
    <span>v1.0.0 • Svelte-powered</span>
  </footer>
</div>

<style>
  .popup {
    width: 300px;
    padding: 16px;
    font-family: system-ui, sans-serif;
  }

  header {
    text-align: center;
    margin-bottom: 16px;
  }

  .logo {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
  }

  .logo h1 {
    margin: 0;
    font-size: 18px;
  }

  .error {
    background: #fee2e2;
    color: #dc2626;
    padding: 8px;
    border-radius: 4px;
    margin-bottom: 12px;
  }

  .tagline {
    font-size: 12px;
    color: #666;
    margin-top: 4px;
  }

  .result {
    background: #f0fdf4;
    padding: 12px;
    border-radius: 8px;
    margin-bottom: 12px;
  }

  .score-section {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-bottom: 12px;
  }

  .score-badge {
    padding: 8px 12px;
    border-radius: 6px;
    color: white;
    font-weight: bold;
    font-size: 16px;
  }

  .details {
    flex: 1;
    font-size: 12px;
  }

  .details > div {
    margin-bottom: 4px;
  }

  .files-preview {
    margin-bottom: 12px;
  }

  .files-header {
    font-weight: bold;
    margin-bottom: 8px;
    font-size: 12px;
  }

  .file-item {
    display: flex;
    justify-content: space-between;
    padding: 4px 8px;
    background: #f8f9fa;
    margin-bottom: 2px;
    border-radius: 4px;
    font-size: 11px;
  }

  .file-path {
    font-family: monospace;
  }

  .file-size {
    color: #666;
  }

  .more-files {
    text-align: center;
    font-style: italic;
    color: #666;
    font-size: 11px;
    padding: 4px;
  }

  .copy-button {
    width: 100%;
    padding: 8px;
    background: #10b981;
    color: white;
    border: none;
    border-radius: 6px;
    cursor: pointer;
    font-size: 12px;
    margin-bottom: 8px;
  }

  .copy-button:hover {
    background: #059669;
  }

  .empty-state {
    text-align: center;
    padding: 24px 16px;
    color: #666;
  }

  .empty-icon {
    font-size: 32px;
    margin-bottom: 12px;
  }

  .empty-state p {
    margin: 8px 0;
  }

  .hint {
    font-size: 12px;
    color: #999;
  }

  .extract-button {
    width: 100%;
    padding: 12px;
    background: #3b82f6;
    color: white;
    border: none;
    border-radius: 8px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
  }

  .extract-button:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .extract-button:hover:not(:disabled) {
    background: #2563eb;
  }

  .spinner {
    animation: spin 1s linear infinite;
  }

  @keyframes spin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }

  footer {
    text-align: center;
    margin-top: 16px;
    font-size: 11px;
    color: #999;
  }
</style>tyle>