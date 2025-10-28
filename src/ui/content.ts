/**
 * FAF Content Script - Runs on every page with bulletproof error handling
 */

import { ChromeRuntime } from '@/adapters/chrome';
import { FAFEngine } from '@/core/engine';
import { PlatformDetector } from '@/adapters/platforms';
import type { ExtractContextMessage, Message, MessageType } from '@/core/types';
import { MESSAGE_TYPES } from '@/core/types';

/**
 * Content script state management
 */
class ContentScriptState {
  private initialized = false;
  private extracting = false;
  private readonly engine: FAFEngine;

  constructor() {
    this.engine = new FAFEngine();
  }

  isInitialized(): boolean {
    return this.initialized;
  }

  setInitialized(value: boolean): void {
    this.initialized = value;
  }

  isExtracting(): boolean {
    return this.extracting;
  }

  setExtracting(value: boolean): void {
    this.extracting = value;
  }

  getEngine(): FAFEngine {
    return this.engine;
  }
}

/**
 * Error handling with specific error types
 */
class ContentScriptError extends Error {
  constructor(
    message: string,
    public readonly code:
      | 'EXTRACTION_FAILED'
      | 'CLIPBOARD_FAILED'
      | 'MESSAGING_FAILED'
      | 'INITIALIZATION_FAILED'
  ) {
    super(message);
    this.name = 'ContentScriptError';
  }
}

/**
 * Content script manager with comprehensive error handling
 */
class ContentScriptManager {
  private readonly state = new ContentScriptState();

  /**
   * Initialize content script with error boundaries
   */
  async initialize(): Promise<void> {
    if (this.state.isInitialized()) {
      return;
    }

    try {
      // Set up message listener with error handling
      ChromeRuntime.onMessage(this.handleMessage.bind(this));

      // Mark as initialized
      this.state.setInitialized(true);

      // Optional: Inject visual indicators based on platform
      await this.injectVisualIndicators();
    } catch (error) {
      throw new ContentScriptError(
        `Initialization failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'INITIALIZATION_FAILED'
      );
    }
  }

  /**
   * Handle messages from popup/background with comprehensive error handling
   */
  private handleMessage(
    message: Message,
    _sender: chrome.runtime.MessageSender,
    sendResponse: (response?: unknown) => void
  ): boolean {
    try {
      // Validate message structure
      if (!this.isValidMessage(message)) {
        sendResponse({ success: false, error: 'Invalid message format' });
        return true;
      }

      // Handle different message types
      switch (message.type) {
        case 'PING':
          // Readiness check - respond immediately
          sendResponse({ type: 'PONG', ready: true, timestamp: Date.now() });
          return true;

        case 'EXTRACT_CONTEXT':
          this.handleExtractContext(message as ExtractContextMessage)
            .then((result) => sendResponse(result))
            .catch((error) => {
              sendResponse({
                success: false,
                error: error instanceof Error ? error.message : 'Extraction failed',
              });
            });
          return true; // Async response

        default:
          sendResponse({ success: false, error: `Unknown message type: ${message.type}` });
          return true;
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Message handling failed';
      sendResponse({ success: false, error: errorMessage });
      return true;
    }
  }

  /**
   * Handle context extraction with timeout and error recovery
   */
  private async handleExtractContext(
    _message: ExtractContextMessage
  ): Promise<import('@/core/types').ExtractionResult> {
    console.log('🎯 [CONTENT SCRIPT] handleExtractContext() called');

    try {
      // Prevent concurrent extractions
      if (this.state.isExtracting()) {
        console.error('🚨 Already extracting!');
        throw new ContentScriptError('Extraction already in progress', 'EXTRACTION_FAILED');
      }

      console.log('🎯 [CONTENT SCRIPT] Setting extracting state...');
      this.state.setExtracting(true);
      console.log('🎯 [CONTENT SCRIPT] State set, starting engine.extract()');

      // Extract context with the engine
      const result = await this.state.getEngine().extract();
      console.log('🎯 [CONTENT SCRIPT] engine.extract() completed:', result.success);

      if (!result.success) {
        throw new ContentScriptError(`Extraction failed: ${result.error}`, 'EXTRACTION_FAILED');
      }

      // Send success message to background
      await ChromeRuntime.sendMessage({
        type: 'CONTEXT_EXTRACTED',
        payload: result,
        timestamp: Date.now(),
        source: 'content',
      });

      // Show success notification (no clipboard - popup handles that)
      this.showSuccessNotification();

      // Return the extraction result to the popup
      return result;
    } catch (error) {
      console.error('🚨 [CONTENT SCRIPT] Catch block - error occurred:', error);
      console.error('🚨 [CONTENT SCRIPT] Error details:', error instanceof Error ? error.message : error);
      console.error('🚨 [CONTENT SCRIPT] Stack:', error instanceof Error ? error.stack : 'No stack');

      // Send error to background (don't await to prevent blocking)
      ChromeRuntime.sendMessage({
        type: 'ERROR',
        payload: {
          error: error instanceof Error ? error.message : 'Unknown extraction error',
          code: error instanceof ContentScriptError ? error.code : 'UNKNOWN_ERROR',
          ...(error instanceof Error && error.stack ? { stack: error.stack } : {}),
        },
        timestamp: Date.now(),
        source: 'content',
      }).catch((msgError) => {
        // Don't throw on messaging errors during error reporting
        console.warn('Failed to send error to background:', msgError);
      });

      // Re-throw for caller
      throw error;
    } finally {
      this.state.setExtracting(false);
    }
  }

  /**
   * Show success notification for extraction
   */
  private showSuccessNotification(): void {
    try {
      const notification = document.createElement('div');
      notification.className = 'faf-success-notification';

      notification.innerHTML = `
        <div class="faf-notification-content">
          <span class="faf-notification-text">Stack⚡️Grabbed</span>
        </div>
      `;

      // Add styles
      Object.assign(notification.style, {
        position: 'fixed',
        top: '20px',
        right: '20px', // Position near the popup on the right
        background: 'linear-gradient(135deg, #2c3e50 0%, #34495e 100%)', // Steel blue
        color: '#ffffff',
        padding: '12px 16px',
        borderRadius: '8px',
        fontFamily: 'system-ui, sans-serif',
        fontSize: '14px',
        fontWeight: '600',
        zIndex: '2147483647', // Maximum z-index value
        boxShadow: '0 4px 12px rgba(44, 62, 80, 0.3)',
        animation: 'fafSlideIn 0.3s ease-out',
      });

      // Add animation keyframes if not already present
      if (!document.querySelector('#faf-notification-styles')) {
        const style = document.createElement('style');
        style.id = 'faf-notification-styles';
        style.textContent = `
          @keyframes fafSlideIn {
            from { transform: translateX(100%); opacity: 0; }
            to { transform: translateX(0); opacity: 1; }
          }
        `;
        document.head.appendChild(style);
      }

      document.body.appendChild(notification);

      // Auto-remove after 3 seconds
      setTimeout(() => {
        if (notification.parentNode) {
          notification.parentNode.removeChild(notification);
        }
      }, 3000);
    } catch (error) {
      // Don't fail extraction if notification fails
      console.warn('Failed to show success notification:', error);
    }
  }

  /**
   * Inject visual indicators for supported platforms
   */
  private async injectVisualIndicators(): Promise<void> {
    try {
      // This is optional and should not break if it fails
      // Use cached platform if available, otherwise 'unknown' for immediate response
      const detector = new PlatformDetector();
      const platform = detector.getCached() || 'unknown';

      if (platform === 'github') {
        this.injectGitHubBadge();
      } else if (platform === 'monaco' || platform === 'codemirror') {
        this.injectEditorWidget();
      }
    } catch (error) {
      // Visual indicators are non-critical
      console.warn('Failed to inject visual indicators:', error);
    }
  }

  /**
   * Inject GitHub repository badge
   */
  private injectGitHubBadge(): void {
    try {
      const repoHeader = document.querySelector('[data-hpc], .repository-content');
      if (!repoHeader) return;

      const badge = document.createElement('div');
      badge.className = 'faf-github-badge';
      badge.innerHTML = `
        <span style="font-size: 16px;">⚡️</span>
        <span style="margin-left: 6px; font-weight: 600;">FAF Ready</span>
      `;

      Object.assign(badge.style, {
        display: 'inline-flex',
        alignItems: 'center',
        padding: '4px 12px',
        background: '#FF6B35',
        color: '#FFF8F0',
        borderRadius: '16px',
        fontSize: '12px',
        cursor: 'pointer',
        margin: '8px',
        transition: 'transform 0.2s ease',
      });

      badge.addEventListener('click', () => {
        this.handleExtractContext({
          type: 'EXTRACT_CONTEXT',
          timestamp: Date.now(),
          source: 'content',
        }).catch((error) => {
          console.error('Badge extraction failed:', error);
        });
      });

      badge.addEventListener('mouseenter', () => {
        badge.style.transform = 'scale(1.05)';
      });

      badge.addEventListener('mouseleave', () => {
        badge.style.transform = 'scale(1)';
      });

      repoHeader.appendChild(badge);
    } catch (error) {
      console.warn('Failed to inject GitHub badge:', error);
    }
  }

  /**
   * Inject floating widget for code editors
   */
  private injectEditorWidget(): void {
    try {
      const widget = document.createElement('div');
      widget.className = 'faf-editor-widget';
      widget.innerHTML = `
        <div style="font-size: 20px;">⚡️</div>
        <div style="font-size: 10px; margin-top: 2px;">FAF</div>
      `;

      Object.assign(widget.style, {
        position: 'fixed',
        top: '20px',
        right: '20px',
        width: '48px',
        height: '48px',
        background: 'rgba(255, 107, 53, 0.9)',
        color: '#FFF8F0',
        borderRadius: '50%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'pointer',
        zIndex: '999998',
        transition: 'all 0.2s ease',
        fontFamily: 'system-ui, sans-serif',
        fontWeight: '600',
      });

      widget.addEventListener('click', () => {
        this.handleExtractContext({
          type: 'EXTRACT_CONTEXT',
          timestamp: Date.now(),
          source: 'content',
        }).catch((error) => {
          console.error('Widget extraction failed:', error);
        });
      });

      widget.addEventListener('mouseenter', () => {
        widget.style.transform = 'scale(1.1)';
        widget.style.background = '#FF6B35';
      });

      widget.addEventListener('mouseleave', () => {
        widget.style.transform = 'scale(1)';
        widget.style.background = 'rgba(255, 107, 53, 0.9)';
      });

      document.body.appendChild(widget);
    } catch (error) {
      console.warn('Failed to inject editor widget:', error);
    }
  }

  /**
   * Validate message structure
   */
  private isValidMessage(message: unknown): message is Message {
    if (!message || typeof message !== 'object') return false;

    const msg = message as Record<string, unknown>;
    return (
      typeof msg.type === 'string' &&
      MESSAGE_TYPES.includes(msg.type as MessageType) &&
      typeof msg.timestamp === 'number' &&
      typeof msg.source === 'string'
    );
  }
}

// Initialize content script with comprehensive error handling
const manager = new ContentScriptManager();

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    manager.initialize().catch((error) => {
      console.error('FAF Content Script initialization failed:', error);
    });
  });
} else {
  manager.initialize().catch((error) => {
    console.error('FAF Content Script initialization failed:', error);
  });
}
