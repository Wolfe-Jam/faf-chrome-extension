<script lang="ts">
  import type { FAFFile } from '@/core/types';
  
  export let files: FAFFile[];
  export let maxDisplay: number = 5;

  // Format file size
  function formatSize(bytes: number): string {
    if (bytes < 1024) return `${bytes}B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
  }

  $: displayFiles = files.slice(0, maxDisplay);
  $: remainingCount = Math.max(0, files.length - maxDisplay);
</script>

<div class="file-list">
  {#each displayFiles as file}
    <div class="file-item">
      <span class="file-name" title={file.path}>{file.path}</span>
      <span class="file-size">{formatSize(file.content.length)}</span>
    </div>
  {/each}
  
  {#if remainingCount > 0}
    <div class="more-files">
      +{remainingCount} more file{remainingCount === 1 ? '' : 's'}
    </div>
  {/if}
</div>

<style>
  .file-list {
    background: #f9fafb;
    border-radius: 8px;
    padding: 12px;
    margin-bottom: 12px;
    max-height: 150px;
    overflow-y: auto;
    border: 1px solid #e5e7eb;
  }

  .file-item {
    display: flex;
    justify-content: space-between;
    padding: 6px 0;
    font-size: 13px;
    border-bottom: 1px solid #e5e7eb;
  }

  .file-item:last-child {
    border-bottom: none;
  }

  .file-name {
    color: #4b5563;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    flex: 1;
    margin-right: 8px;
    font-family: 'SFMono-Regular', Monaco, 'Cascadia Code', monospace;
  }

  .file-size {
    color: #9ca3af;
    font-weight: 500;
    flex-shrink: 0;
  }

  .more-files {
    padding-top: 8px;
    font-size: 12px;
    color: #6b7280;
    text-align: center;
    font-weight: 500;
    border-top: 1px dashed #d1d5db;
    margin-top: 8px;
  }

  /* Scrollbar styling */
  .file-list::-webkit-scrollbar {
    width: 4px;
  }

  .file-list::-webkit-scrollbar-track {
    background: transparent;
  }

  .file-list::-webkit-scrollbar-thumb {
    background: #d1d5db;
    border-radius: 2px;
  }

  .file-list::-webkit-scrollbar-thumb:hover {
    background: #9ca3af;
  }
</style>