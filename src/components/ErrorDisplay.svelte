<script lang="ts">
  export let error: string | null;
  
  // Auto-dismiss error after 5 seconds
  let timeoutId: number;
  
  $: if (error) {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => {
      error = null;
    }, 5000);
  }
</script>

{#if error}
  <div class="error" role="alert">
    <span class="error-icon" aria-hidden="true">⚠️</span>
    <span class="error-text">{error}</span>
    <button 
      class="dismiss-button" 
      on:click={() => error = null}
      aria-label="Dismiss error"
      title="Dismiss"
    >
      ✕
    </button>
  </div>
{/if}

<style>
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
    border-left: 4px solid #dc2626;
  }

  .error-icon {
    font-size: 16px;
    flex-shrink: 0;
  }

  .error-text {
    flex: 1;
    line-height: 1.4;
  }

  .dismiss-button {
    background: none;
    border: none;
    color: #dc2626;
    cursor: pointer;
    padding: 2px 6px;
    border-radius: 4px;
    font-size: 12px;
    opacity: 0.7;
    transition: opacity 0.2s;
    flex-shrink: 0;
  }

  .dismiss-button:hover {
    opacity: 1;
    background: rgba(220, 38, 38, 0.1);
  }
</style>