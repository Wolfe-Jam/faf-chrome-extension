<script lang="ts">
  import { onMount } from 'svelte';
  import { 
    extractionStore, 
    isExtractingStore, 
    errorStore, 
    extractionActions,
    hasExtractionStore,
    sessionStore
  } from '@/stores/extraction';
  import { ChromeTabs } from '@/adapters/chrome';
  import { telemetry } from '@/core/telemetry';
  
  // Components
  import ScoreBadge from '../components/ScoreBadge.svelte';
  import ErrorDisplay from '../components/ErrorDisplay.svelte';
  import FileList from '../components/FileList.svelte';

  // Reactive stores
  $: extraction = $extractionStore;
  $: isExtracting = $isExtractingStore;
  $: error = $errorStore;
  $: hasExtraction = $hasExtractionStore;

  // Initialize popup
  onMount(async () => {
    // Track popup opened
    telemetry.track('user_action', {
      action: 'popup_opened',
      timestamp: Date.now()
    });

    // Load stored extraction
    await extractionActions.loadStoredExtraction();
  });

  // Handle extraction
  async function handleExtract() {
    if (isExtracting) return;

    extractionActions.setExtracting(true);

    try {
      telemetry.track('user_action', {
        action: 'extract_clicked',
        timestamp: Date.now()
      });

      const activeTab = await ChromeTabs.getActiveTab();
      if (!activeTab?.id) {
        throw new Error('No active tab found');
      }

      // Send message to content script
      const response = await chrome.tabs.sendMessage(activeTab.id, { action: 'extract' });

      if (response.success) {
        await extractionActions.setExtraction(response);
        
        telemetry.track('extraction_complete', {
          platform: response.faf.metadata.platform,
          score: response.faf.score.total,
          fileCount: response.faf.files.length
        });
      } else {
        throw new Error(response.error || 'Extraction failed');
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to extract context';
      extractionActions.setError(errorMessage);

      telemetry.track('extraction_error', {
        error: errorMessage,
        phase: 'popup_extract'
      });
    } finally {
      extractionActions.setExtracting(false);
    }
  }

  // Copy to clipboard
  async function handleCopy() {
    if (!hasExtraction || !extraction) return;

    try {
      const fafContent = JSON.stringify(extraction.faf, null, 2);
      await navigator.clipboard.writeText(fafContent);

      telemetry.track('user_action', {
        action: 'copy_to_clipboard',
        size: fafContent.length
      });

      // Visual feedback
      copied = true;
      setTimeout(() => copied = false, 2000);
    } catch (err) {
      extractionActions.setError('Failed to copy to clipboard');
    }
  }

  let copied = false;
</script>

<div class="popup">
  <header>
    <div class="logo">
      <span class="emoji">⚡</span>
      <h1>FAF - Fast AF</h1>
    </div>
    <div class="tagline">Extract perfect AI context in 0.3s</div>
  </header>

  <main>
    <ErrorDisplay bind:error={$errorStore} />

    {#if hasExtraction && extraction}
      <div class="extraction-result">
        <ScoreBadge 
          score={extraction.faf.score.total}
          platform={extraction.faf.metadata.platform}
          fileCount={extraction.faf.files.length}
        />

        <FileList files={extraction.faf.files} maxDisplay={5} />

        <button class="copy-button" on:click={handleCopy}>
          {copied ? '✓ Copied!' : 'Copy FAF'}
        </button>
      </div>
    {:else if !error}
      <div class="empty-state">
        <div class="empty-icon">📄</div>
        <p>No extraction yet</p>
        <p class="hint">Click extract to analyze the current page</p>
      </div>
    {/if}

    <button 
      class="extract-button"
      class:extracting={isExtracting}
      on:click={handleExtract}
      disabled={isExtracting}
    >
      {#if isExtracting}
        <span class="spinner">⟳</span>
        Extracting...
      {:else}
        <span class="bolt">⚡</span>
        Extract Context
      {/if}
    </button>
  </main>

  <footer>
    <a href="https://github.com/Wolfe-Jam/faf-chrome-extension" target="_blank">
      v1.0.0
    </a>
    <span class="separator">•</span>
    <span class="tagline-footer">Stop FAFfing About</span>
    <span class="separator">•</span>
    <span class="session-info">{$sessionStore.extractionCount} extractions</span>
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
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
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

  .extraction-result {
    margin-bottom: 16px;
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
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
  }

  .extract-button:hover:not(:disabled) {
    transform: translateY(-1px);
    box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
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

  .copy-button:hover {
    background: #e5e7eb;
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
    flex-wrap: wrap;
  }

  footer a {
    color: #6b7280;
    text-decoration: none;
  }

  footer a:hover {
    color: #667eea;
  }

  .separator {
    color: #d1d5db;
  }

  .tagline-footer {
    font-style: italic;
  }

  .session-info {
    font-size: 11px;
    opacity: 0.8;
  }
</style>