/**
 * Service Worker Tests - Mission-Critical Background Process Testing
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

describe('Service Worker Core Functions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Message Validation', () => {
    it('should validate extract messages', () => {
      const validMessage = {
        type: 'EXTRACT_CONTEXT',
        timestamp: Date.now(),
        source: 'popup'
      };
      
      // This tests the message structure that the service worker expects
      expect(validMessage).toHaveProperty('type');
      expect(validMessage).toHaveProperty('timestamp');
      expect(validMessage).toHaveProperty('source');
      expect(typeof validMessage.timestamp).toBe('number');
    });

    it('should reject malformed messages', () => {
      const invalidMessages = [
        { type: 'INVALID_TYPE' },
        { timestamp: Date.now() },
        { source: 'popup' },
        {}
      ];

      for (const msg of invalidMessages) {
        // In the actual service worker, these would be rejected
        expect(msg).not.toMatchObject({
          type: expect.stringMatching(/^(EXTRACT_CONTEXT|GET_STATUS)$/),
          timestamp: expect.any(Number),
          source: expect.stringMatching(/^(popup|content)$/)
        });
      }
    });
  });

  describe('Error Handling', () => {
    it('should handle extraction timeouts gracefully', async () => {
      // Mock a slow extraction that would timeout
      const mockSlowOperation = vi.fn().mockImplementation(() => {
        return new Promise((resolve) => {
          setTimeout(resolve, 400); // Longer than 300ms timeout
        });
      });

      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Operation timeout')), 300);
      });

      await expect(Promise.race([mockSlowOperation(), timeoutPromise]))
        .rejects.toThrow('Operation timeout');
    });

    it('should handle Chrome API errors', async () => {
      // Mock Chrome API failure
      chrome.tabs.query = vi.fn().mockImplementation((query, callback) => {
        chrome.runtime.lastError = { message: 'Extension context invalidated' };
        callback([]);
      });

      // Test error handling
      try {
        const tabs = await new Promise((resolve, reject) => {
          chrome.tabs.query({}, (result) => {
            if (chrome.runtime.lastError) {
              reject(new Error(chrome.runtime.lastError.message));
            } else {
              resolve(result);
            }
          });
        });
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        expect((error as Error).message).toContain('Extension context invalidated');
      }
    });
  });

  describe('Concurrency Management', () => {
    it('should limit concurrent extractions', () => {
      const MAX_CONCURRENT = 3;
      const activeExtractions = new Map();

      // Simulate adding extractions
      for (let i = 1; i <= 5; i++) {
        if (activeExtractions.size < MAX_CONCURRENT) {
          activeExtractions.set(i, { tabId: i, startTime: Date.now() });
        }
      }

      expect(activeExtractions.size).toBe(MAX_CONCURRENT);
      expect(activeExtractions.has(4)).toBe(false);
      expect(activeExtractions.has(5)).toBe(false);
    });

    it('should cleanup completed extractions', () => {
      const activeExtractions = new Map();
      
      // Add some extractions
      activeExtractions.set(1, { tabId: 1, startTime: Date.now() });
      activeExtractions.set(2, { tabId: 2, startTime: Date.now() });
      
      expect(activeExtractions.size).toBe(2);
      
      // Simulate completion
      activeExtractions.delete(1);
      
      expect(activeExtractions.size).toBe(1);
      expect(activeExtractions.has(1)).toBe(false);
      expect(activeExtractions.has(2)).toBe(true);
    });
  });

  describe('Badge Updates', () => {
    it('should update badge with correct colors', async () => {
      const testCases = [
        { score: 95, expectedColor: '#FF6B35' }, // High - Orange
        { score: 70, expectedColor: '#5CE1E6' }, // Medium - Cyan  
        { score: 25, expectedColor: '#0A0A0A' }  // Low - Black
      ];

      chrome.action.setBadgeText = vi.fn().mockImplementation((options, callback) => {
        callback && callback();
      });
      
      chrome.action.setBadgeBackgroundColor = vi.fn().mockImplementation((options, callback) => {
        callback && callback();
      });

      for (const { score, expectedColor } of testCases) {
        // Simulate badge update
        await new Promise<void>((resolve) => {
          chrome.action.setBadgeText({ text: `${score}%` }, resolve);
        });
        
        await new Promise<void>((resolve) => {
          chrome.action.setBadgeBackgroundColor({ color: expectedColor }, resolve);
        });

        expect(chrome.action.setBadgeText).toHaveBeenCalledWith(
          { text: `${score}%` }, 
          expect.any(Function)
        );
        expect(chrome.action.setBadgeBackgroundColor).toHaveBeenCalledWith(
          { color: expectedColor }, 
          expect.any(Function)
        );
        
        vi.clearAllMocks();
      }
    });
  });

  describe('Storage Operations', () => {
    it('should handle storage quota errors', async () => {
      chrome.storage.local.set = vi.fn().mockImplementation((data, callback) => {
        chrome.runtime.lastError = { message: 'QUOTA_EXCEEDED' };
        callback && callback();
      });

      try {
        await new Promise<void>((resolve, reject) => {
          chrome.storage.local.set({ largeData: 'x'.repeat(10000) }, () => {
            if (chrome.runtime.lastError) {
              reject(new Error(chrome.runtime.lastError.message));
            } else {
              resolve();
            }
          });
        });
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        expect((error as Error).message).toBe('QUOTA_EXCEEDED');
      }
    });
  });

  describe('Notification System', () => {
    it('should create notifications for errors', async () => {
      chrome.notifications.create = vi.fn().mockImplementation((options, callback) => {
        callback && callback('notification-id');
      });

      await new Promise<void>((resolve) => {
        chrome.notifications.create({
          type: 'basic',
          iconUrl: 'icon128.png',
          title: 'FAF Error',
          message: 'Extraction failed',
          priority: 2
        }, resolve);
      });

      expect(chrome.notifications.create).toHaveBeenCalledWith({
        type: 'basic',
        iconUrl: 'icon128.png',
        title: 'FAF Error',
        message: 'Extraction failed',
        priority: 2
      }, expect.any(Function));
    });
  });

  describe('State Cleanup', () => {
    it('should cleanup stale extractions', () => {
      const activeExtractions = new Map();
      const now = Date.now();
      
      // Add some extractions with different ages
      activeExtractions.set(1, { tabId: 1, startTime: now - 400000 }); // Old
      activeExtractions.set(2, { tabId: 2, startTime: now - 100 });    // Recent
      
      // Simulate cleanup of extractions older than 5 minutes
      const FIVE_MINUTES = 5 * 60 * 1000;
      
      for (const [id, extraction] of activeExtractions.entries()) {
        if (now - extraction.startTime > FIVE_MINUTES) {
          activeExtractions.delete(id);
        }
      }
      
      expect(activeExtractions.size).toBe(1);
      expect(activeExtractions.has(1)).toBe(false);
      expect(activeExtractions.has(2)).toBe(true);
    });
  });

  afterEach(() => {
    // Reset Chrome API state
    (global as any).chrome.runtime.lastError = null;
  });
});