<script>
import { onMount } from 'svelte';
import { ChromeStorageAPI, ChromeTabs } from '@/adapters/chrome';
import { DownloadsManager } from '@/adapters/downloads';
import { telemetry } from '@/core/telemetry';

// State
let lastExtraction = null;
let isExtracting = false;
let error = null;
let platform = 'Unknown';
let detectionMethod = 'Unknown';
let confidence = 'Unknown';
let url = '';
let score = 0;

// Detection results
let urlMatched = false;
let domFound = false;
let jsDetected = false;
let scriptFound = false;
let htmlPattern = false;
let projectFound = false;

// Load stored extraction on mount
onMount(async () => {
  try {
    telemetry.track('user_action', {
      action: 'popup_opened',
      timestamp: Date.now(),
    });

    const stored = await ChromeStorageAPI.get(['lastExtraction']);
    if (stored.lastExtraction) {
      lastExtraction = stored.lastExtraction;
      updateExtractionDisplay(lastExtraction);
    }
  } catch (err) {
    error = err instanceof Error ? err.message : 'Failed to load stored data';
  }
});

function updateExtractionDisplay(extraction) {
  if (!extraction?.faf) return;
  
  score = extraction.faf.score || 0;
  platform = extraction.faf.context?.platform || 'Unknown';
  url = extraction.faf.context?.metadata?.url || '';
  
  // Set detection results based on platform
  if (platform === 'github') {
    detectionMethod = 'Git Repository Platform';
    confidence = 'Very High';
    urlMatched = true;
    domFound = true;
    jsDetected = true;
    scriptFound = true;
    htmlPattern = true;
    projectFound = true;
  } else if (platform === 'monaco') {
    detectionMethod = 'Monaco Editor Platform';
    confidence = 'High';
    domFound = true;
    jsDetected = true;
    scriptFound = true;
  } else if (platform === 'codemirror') {
    detectionMethod = 'CodeMirror Platform';
    confidence = 'High';
    domFound = true;
    scriptFound = true;
  } else {
    detectionMethod = 'Generic Code Platform';
    confidence = 'Medium';
    domFound = true;
  }
}

// Handle extraction
async function handleExtract() {
  if (isExtracting) return;

  isExtracting = true;
  error = null;

  try {
    telemetry.track('user_action', {
      action: 'extract_clicked',
      timestamp: Date.now(),
    });

    const activeTab = await ChromeTabs.getActive();
    if (!activeTab?.id) {
      throw new Error('No active tab found');
    }

    // Try to inject content script
    try {
      await chrome.scripting.executeScript({
        target: { tabId: activeTab.id },
        files: ['content.js'],
      });
      await new Promise(resolve => setTimeout(resolve, 100));
    } catch (injectErr) {
      console.log('Content script injection attempted:', injectErr);
    }

    // Send extraction message
    const message = {
      type: 'EXTRACT_CONTEXT',
      timestamp: Date.now(),
      source: 'popup',
    };

    let response;
    try {
      response = await chrome.tabs.sendMessage(activeTab.id, message);
    } catch {
      await new Promise(resolve => setTimeout(resolve, 500));
      try {
        response = await chrome.tabs.sendMessage(activeTab.id, message);
      } catch (finalErr) {
        throw new Error('Unable to communicate with page. Please refresh and try again.');
      }
    }

    if (response?.success) {
      lastExtraction = response;
      updateExtractionDisplay(response);
      await ChromeStorageAPI.set({ lastExtraction: response });

      telemetry.track('extraction_complete', {
        platform: response.faf?.context?.platform || 'unknown',
        score: response.faf?.score || 0,
      });
    } else {
      throw new Error(response?.error || 'Extraction failed');
    }
  } catch (err) {
    error = err instanceof Error ? err.message : 'Failed to extract context';
  } finally {
    isExtracting = false;
  }