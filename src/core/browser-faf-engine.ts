/**
 * Browser-compatible FAF Engine Integration
 * Simplified version without Node.js dependencies
 * NOTE: Scoring removed - this is now an extraction-only tool
 */

import type { CodeContext } from '@/core/types';

export class BrowserFafEngine {
  constructor() {
    // Scoring functionality removed - extension is now extraction-only
  }

  /**
   * Test if the engine is working properly (no scoring)
   */
  async testEngine(): Promise<boolean> {
    return true; // Always passes - no scoring logic needed
  }
}

// Browser-compatible singleton instance
export let browserFafEngine: BrowserFafEngine;

export function initializeBrowserFafEngine(): void {
  browserFafEngine = new BrowserFafEngine();
}
