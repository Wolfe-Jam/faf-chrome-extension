/**
 * Svelte Stores - Global State Management for FAF Extension
 */

import { writable, derived, readable } from 'svelte/store';
import type { ExtractionResult } from '@/core/types';
import { ChromeStorageAPI } from '@/adapters/chrome';

// Core extraction state
export const extractionStore = writable<ExtractionResult | null>(null);
export const isExtractingStore = writable<boolean>(false);
export const errorStore = writable<string | null>(null);

// Derived stores for computed values
export const hasExtractionStore = derived(
  extractionStore,
  ($extraction) => $extraction?.success === true
);

export const extractionScoreStore = derived(
  extractionStore,
  ($extraction) => $extraction?.success ? $extraction.faf.score.total : 0
);

export const fileCountStore = derived(
  extractionStore,
  ($extraction) => $extraction?.success ? $extraction.faf.files.length : 0
);

// Session state
export const sessionStore = writable({
  extractionCount: 0,
  sessionStart: Date.now(),
  lastActivity: Date.now()
});

// Extension status
export const extensionStatusStore = writable<'idle' | 'extracting' | 'error' | 'success'>('idle');

// Store actions (business logic)
export const extractionActions = {
  // Update extraction result and persist
  async setExtraction(result: ExtractionResult) {
    extractionStore.set(result);
    await ChromeStorageAPI.set({ lastExtraction: result });
    
    // Update session stats
    sessionStore.update(session => ({
      ...session,
      extractionCount: session.extractionCount + 1,
      lastActivity: Date.now()
    }));
  },

  // Clear extraction state
  clearExtraction() {
    extractionStore.set(null);
    errorStore.set(null);
    extensionStatusStore.set('idle');
  },

  // Set loading state
  setExtracting(isExtracting: boolean) {
    isExtractingStore.set(isExtracting);
    extensionStatusStore.set(isExtracting ? 'extracting' : 'idle');
    
    if (isExtracting) {
      errorStore.set(null); // Clear previous errors
    }
  },

  // Set error state
  setError(error: string) {
    errorStore.set(error);
    isExtractingStore.set(false);
    extensionStatusStore.set('error');
  },

  // Load stored extraction on app start
  async loadStoredExtraction() {
    try {
      const { lastExtraction } = await ChromeStorageAPI.get(['lastExtraction']);
      if (lastExtraction) {
        extractionStore.set(lastExtraction);
        extensionStatusStore.set('success');
      }
    } catch (error) {
      console.warn('Failed to load stored extraction:', error);
    }
  }
};

// Performance tracking store
export const performanceStore = readable({
  popupLoadTime: 0,
  lastExtractionTime: 0,
  averageExtractionTime: 0
}, (set) => {
  const startTime = performance.now();
  
  // Track popup load time
  const updateLoadTime = () => {
    const loadTime = performance.now() - startTime;
    set(prev => ({ ...prev, popupLoadTime: loadTime }));
  };

  // Update when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', updateLoadTime);
  } else {
    updateLoadTime();
  }

  return () => {
    document.removeEventListener('DOMContentLoaded', updateLoadTime);
  };
});