/**
 * Chrome API Type-Safe Wrapper
 * All Chrome extension APIs with proper error handling and types
 */

import type { Message, ExtractionResult, Score } from '@/core/types';
import { FAFError, FAFErrorCode } from '@/core/errors';

export interface ChromeTab {
  readonly id: number;
  readonly url: string;
  readonly title: string;
  readonly active: boolean;
}

export interface ChromeStorage {
  readonly lastExtraction?: ExtractionResult;
  readonly timestamp?: number;
  readonly settings?: {
    readonly autoExtract: boolean;
    readonly showNotifications: boolean;
  };
  readonly faf_telemetry?: {
    readonly sessionId: string;
    readonly eventCount: number;
    readonly metricsCount: number;
    readonly lastEvent?: any;
    readonly health: string;
  };
}

/**
 * @deprecated Use FAFError from @/core/errors instead
 */
export class ChromeAPIError extends Error {
  constructor(
    message: string,
    public readonly code: 'PERMISSION_DENIED' | 'TAB_NOT_FOUND' | 'STORAGE_ERROR' | 'RUNTIME_ERROR'
  ) {
    super(message);
    this.name = 'ChromeAPIError';
  }
}

/**
 * Type-safe wrapper for Chrome tabs API
 */
export class ChromeTabs {
  static async getActive(): Promise<ChromeTab> {
    return new Promise((resolve, reject) => {
      try {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
          if (chrome.runtime.lastError) {
            reject(new FAFError(
              FAFErrorCode.CHROME_RUNTIME_ERROR,
              chrome.runtime.lastError.message || 'Unknown runtime error',
              { technicalDetails: 'Chrome tabs API operation failed' }
            ));
            return;
          }
          
          const activeTab = tabs[0];
          if (!activeTab?.id || !activeTab.url) {
            reject(new FAFError(
              FAFErrorCode.CHROME_TAB_NOT_FOUND,
              'No active tab found',
              { technicalDetails: 'Chrome tabs API operation failed' }
            ));
            return;
          }
          
          resolve({
            id: activeTab.id,
            url: activeTab.url,
            title: activeTab.title ?? '',
            active: activeTab.active
          });
        });
      } catch (error) {
        reject(new FAFError(
          FAFErrorCode.CHROME_API_UNAVAILABLE,
          error instanceof Error ? error.message : 'Unknown tabs API error',
          { technicalDetails: "Chrome API operation failed" }
        ));
      }
    });
  }

  static async sendMessage(tabId: number, message: Message): Promise<void> {
    return new Promise((resolve) => {
      try {
        chrome.tabs.sendMessage(tabId, message, (_response) => {
          if (chrome.runtime.lastError) {
            // Gracefully handle tab messaging errors
            console.warn('FAF: Tab messaging warning (non-blocking):', chrome.runtime.lastError.message);
            resolve();
            return;
          }
          resolve();
        });
      } catch (error) {
        // Never throw - always graceful recovery
        console.warn('FAF: Tab messaging warning (non-blocking):', error);
        resolve();
      }
    });
  }

  static async executeScript(tabId: number, files: readonly string[]): Promise<void> {
    return new Promise((resolve) => {
      try {
        chrome.scripting.executeScript({
          target: { tabId },
          files: [...files]
        }, () => {
          if (chrome.runtime.lastError) {
            // Gracefully handle script execution errors
            console.warn('FAF: Script execution warning (non-blocking):', chrome.runtime.lastError.message);
            resolve();
            return;
          }
          resolve();
        });
      } catch (error) {
        // Never throw - always graceful recovery
        console.warn('FAF: Script execution warning (non-blocking):', error);
        resolve();
      }
    });
  }
}

/**
 * Type-safe wrapper for Chrome storage API
 */
export class ChromeStorageAPI {
  static async get<K extends keyof ChromeStorage>(
    keys: readonly K[]
  ): Promise<Pick<ChromeStorage, K>> {
    const MAX_RETRIES = 3;
    const RETRY_DELAY_MS = 100;

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        return await new Promise((resolve, reject) => {
          chrome.storage.local.get([...keys], (result) => {
            if (chrome.runtime.lastError) {
              // Create a specific error to check for retry
              const error = new FAFError(
                FAFErrorCode.CHROME_STORAGE_ERROR,
                chrome.runtime.lastError.message || 'Unknown storage error',
                { technicalDetails: `Chrome API operation failed on attempt ${attempt}` }
              );
              return reject(error);
            }
            resolve(result as Pick<ChromeStorage, K>);
          });
        });
      } catch (error) {
        if (error instanceof FAFError && error.message.includes('Receiving end does not exist') && attempt < MAX_RETRIES) {
          console.warn(`FAF: Storage connection failed (attempt ${attempt}). Retrying in ${RETRY_DELAY_MS}ms...`);
          await new Promise(resolve => setTimeout(resolve, RETRY_DELAY_MS));
          continue; // next attempt
        }
        // If it's another error or the last attempt, re-throw
        throw error;
      }
    }

    // This line should theoretically be unreachable if MAX_RETRIES > 0
    throw new FAFError(
      FAFErrorCode.CHROME_STORAGE_ERROR,
      'Failed to get data from storage after multiple retries',
      { technicalDetails: 'Exhausted all retry attempts for chrome.storage.local.get' }
    );
  }

  static async set(data: Partial<ChromeStorage>): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        chrome.storage.local.set(data, () => {
          if (chrome.runtime.lastError) {
            reject(new FAFError(
              FAFErrorCode.CHROME_STORAGE_QUOTA_EXCEEDED,
              chrome.runtime.lastError.message || 'Unknown storage error',
              { technicalDetails: "Chrome API operation failed" }
            ));
            return;
          }
          resolve();
        });
      } catch (error) {
        reject(new FAFError(
          FAFErrorCode.CHROME_API_UNAVAILABLE,
          error instanceof Error ? error.message : 'Unknown storage error',
          { technicalDetails: "Chrome API operation failed" }
        ));
      }
    });
  }

  static async clear(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        chrome.storage.local.clear(() => {
          if (chrome.runtime.lastError) {
            reject(new FAFError(
              FAFErrorCode.CHROME_STORAGE_ERROR,
              chrome.runtime.lastError.message || 'Unknown storage error',
              { technicalDetails: "Chrome API operation failed" }
            ));
            return;
          }
          resolve();
        });
      } catch (error) {
        reject(new FAFError(
          FAFErrorCode.CHROME_API_UNAVAILABLE,
          error instanceof Error ? error.message : 'Unknown storage error',
          { technicalDetails: "Chrome API operation failed" }
        ));
      }
    });
  }
}

/**
 * Type-safe wrapper for Chrome action API
 */
export class ChromeAction {
  static async setBadgeText(text: string): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        chrome.action.setBadgeText({ text }, () => {
          if (chrome.runtime.lastError) {
            reject(new FAFError(
              FAFErrorCode.CHROME_RUNTIME_ERROR,
              chrome.runtime.lastError.message || 'Unknown runtime error',
              { technicalDetails: "Chrome API operation failed" }
            ));
            return;
          }
          resolve();
        });
      } catch (error) {
        reject(new FAFError(
          FAFErrorCode.CHROME_API_UNAVAILABLE,
          error instanceof Error ? error.message : 'Unknown action error',
          { technicalDetails: "Chrome API operation failed" }
        ));
      }
    });
  }

  static async setBadgeBackgroundColor(color: string): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        chrome.action.setBadgeBackgroundColor({ color }, () => {
          if (chrome.runtime.lastError) {
            reject(new FAFError(
              FAFErrorCode.CHROME_RUNTIME_ERROR,
              chrome.runtime.lastError.message || 'Unknown runtime error',
              { technicalDetails: "Chrome API operation failed" }
            ));
            return;
          }
          resolve();
        });
      } catch (error) {
        reject(new FAFError(
          FAFErrorCode.CHROME_API_UNAVAILABLE,
          error instanceof Error ? error.message : 'Unknown action error',
          { technicalDetails: "Chrome API operation failed" }
        ));
      }
    });
  }

  static async updateBadge(score: Score): Promise<void> {
    const scoreValue = score as number;
    const badgeText = `${scoreValue}%`;
    
    let badgeColor: string;
    if (scoreValue >= 80) {
      badgeColor = '#FF6B35'; // Orange
    } else if (scoreValue >= 50) {
      badgeColor = '#5CE1E6'; // Cyan
    } else {
      badgeColor = '#0A0A0A'; // Black
    }

    await Promise.all([
      ChromeAction.setBadgeText(badgeText),
      ChromeAction.setBadgeBackgroundColor(badgeColor)
    ]);
  }
}

/**
 * Type-safe wrapper for Chrome notifications API
 */
export class ChromeNotifications {
  static async create(
    title: string,
    message: string,
    iconUrl: string = 'icon128.png'
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        chrome.notifications.create({
          type: 'basic',
          iconUrl,
          title,
          message,
          priority: 2
        }, () => {
          if (chrome.runtime.lastError) {
            reject(new FAFError(
              FAFErrorCode.CHROME_RUNTIME_ERROR,
              chrome.runtime.lastError.message || 'Unknown runtime error',
              { technicalDetails: "Chrome API operation failed" }
            ));
            return;
          }
          resolve();
        });
      } catch (error) {
        reject(new FAFError(
          FAFErrorCode.CHROME_API_UNAVAILABLE,
          error instanceof Error ? error.message : 'Unknown notification error',
          { technicalDetails: "Chrome API operation failed" }
        ));
      }
    });
  }
}

/**
 * Type-safe wrapper for Chrome runtime messaging
 */
export class ChromeRuntime {
  static sendMessage(message: Message): Promise<any> {
    return new Promise((resolve, reject) => {
      try {
        chrome.runtime.sendMessage(message, (response) => {
          if (chrome.runtime.lastError) {
            return reject(new FAFError(
              FAFErrorCode.CHROME_RUNTIME_ERROR,
              chrome.runtime.lastError.message || 'Unknown runtime error'
            ));
          }
          resolve(response);
        });
      } catch (error) {
        reject(new FAFError(
          FAFErrorCode.CHROME_API_UNAVAILABLE,
          error instanceof Error ? error.message : 'Unknown messaging error'
        ));
      }
    });
  }

  static onMessage(
    listener: (
      message: Message,
      sender: chrome.runtime.MessageSender,
      sendResponse: (response?: unknown) => void
    ) => boolean | void
  ): void {
    chrome.runtime.onMessage.addListener(listener);
  }

  static onInstalled(listener: () => void): void {
    chrome.runtime.onInstalled.addListener(listener);
  }
}

/**
 * Type-safe wrapper for Chrome commands API
 */
export class ChromeCommands {
  static onCommand(listener: (command: string) => void): void {
    chrome.commands.onCommand.addListener(listener);
  }
}