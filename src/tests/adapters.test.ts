/**
 * Chrome Adapter Tests - Type-safe API wrapper validation
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { 
  ChromeTabs, 
  ChromeStorageAPI, 
  ChromeAction, 
  ChromeNotifications,
  ChromeAPIError 
} from '@/adapters/chrome';
import { FAFError } from '@/core/errors';
import { ClipboardManager, ClipboardError } from '@/adapters/clipboard';
import type { FAFFile, Score } from '@/core/types';

describe('Chrome API Adapters', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('ChromeTabs', () => {
    it('should get active tab successfully', async () => {
      const mockTab = { id: 1, url: 'https://github.com/test', title: 'Test', active: true };
      chrome.tabs.query = vi.fn().mockImplementation((query, callback) => {
        callback([mockTab]);
      });

      const tab = await ChromeTabs.getActive();
      expect(tab).toEqual(mockTab);
    });

    it('should handle no active tab error', async () => {
      chrome.tabs.query = vi.fn().mockImplementation((query, callback) => {
        callback([]);
      });

      await expect(ChromeTabs.getActive()).rejects.toThrow(FAFError);
    });

    it('should handle chrome.runtime.lastError', async () => {
      chrome.tabs.query = vi.fn().mockImplementation((query, callback) => {
        chrome.runtime.lastError = { message: 'Tab access denied' };
        callback([]);
      });

      await expect(ChromeTabs.getActive()).rejects.toThrow('Tab access denied');
    });

    it('should send messages to tabs', async () => {
      const tabId = 1;
      const message = { type: 'TEST', timestamp: Date.now(), source: 'test' } as any;

      chrome.tabs.sendMessage = vi.fn().mockImplementation((id, msg, callback) => {
        callback && callback();
      });

      await expect(ChromeTabs.sendMessage(tabId, message)).resolves.not.toThrow();
      expect(chrome.tabs.sendMessage).toHaveBeenCalledWith(tabId, message, expect.any(Function));
    });
  });

  describe('ChromeStorageAPI', () => {
    it('should store and retrieve data', async () => {
      const testData = { lastExtraction: { success: true }, timestamp: Date.now() };

      chrome.storage.local.set = vi.fn().mockImplementation((data, callback) => {
        callback && callback();
      });

      chrome.storage.local.get = vi.fn().mockImplementation((keys, callback) => {
        callback(testData);
      });

      await ChromeStorageAPI.set(testData);
      const result = await ChromeStorageAPI.get(['lastExtraction']);

      expect(result).toEqual(testData);
    });

    it('should handle storage quota errors', async () => {
      chrome.storage.local.set = vi.fn().mockImplementation((data, callback) => {
        chrome.runtime.lastError = { message: 'Storage quota exceeded' };
        callback && callback();
      });

      await expect(ChromeStorageAPI.set({ test: 'data' })).rejects.toThrow(FAFError);
    });

    it('should clear storage', async () => {
      chrome.storage.local.clear = vi.fn().mockImplementation((callback) => {
        callback && callback();
      });

      await expect(ChromeStorageAPI.clear()).resolves.not.toThrow();
    });
  });

  describe('ChromeAction', () => {
    it('should update badge with score', async () => {
      const score = 85 as Score;

      chrome.action.setBadgeText = vi.fn().mockImplementation((options, callback) => {
        callback && callback();
      });

      chrome.action.setBadgeBackgroundColor = vi.fn().mockImplementation((options, callback) => {
        callback && callback();
      });

      await ChromeAction.updateBadge(score);

      expect(chrome.action.setBadgeText).toHaveBeenCalledWith({ text: '85%' }, expect.any(Function));
      expect(chrome.action.setBadgeBackgroundColor).toHaveBeenCalledWith({ color: '#FF6B35' }, expect.any(Function));
    });

    it('should use correct colors for different score ranges', async () => {
      const testCases = [
        { score: 90, expectedColor: '#FF6B35' }, // High - Orange
        { score: 65, expectedColor: '#5CE1E6' }, // Medium - Cyan
        { score: 30, expectedColor: '#0A0A0A' }  // Low - Black
      ];

      chrome.action.setBadgeBackgroundColor = vi.fn().mockImplementation((options, callback) => {
        callback && callback();
      });

      for (const { score, expectedColor } of testCases) {
        vi.clearAllMocks();
        await ChromeAction.updateBadge(score as Score);
        expect(chrome.action.setBadgeBackgroundColor).toHaveBeenCalledWith({ color: expectedColor }, expect.any(Function));
      }
    });
  });

  describe('ChromeNotifications', () => {
    it('should create notifications', async () => {
      chrome.notifications.create = vi.fn().mockImplementation((options, callback) => {
        callback && callback('notification-id');
      });

      await ChromeNotifications.create('Test Title', 'Test Message');

      expect(chrome.notifications.create).toHaveBeenCalledWith({
        type: 'basic',
        iconUrl: 'icon128.png',
        title: 'Test Title',
        message: 'Test Message',
        priority: 2
      }, expect.any(Function));
    });
  });
});

describe('Clipboard Manager', () => {
  let mockFAF: FAFFile;

  beforeEach(() => {
    mockFAF = {
      version: '1.0.0',
      generated: new Date().toISOString(),
      score: 85 as Score,
      context: {
        platform: 'github',
        score: 85 as Score,
        structure: { files: [], directories: [], entryPoints: [], totalFiles: 0, totalLines: 0 },
        dependencies: { runtime: { language: 'TypeScript', version: '5.3.0', packageManager: 'npm' }, packages: [], lockFile: null },
        environment: { variables: [], configFiles: [] },
        metadata: {
          extractionTime: 150,
          version: '1.0.0',
          timestamp: new Date().toISOString(),
          url: 'https://github.com/test',
          userAgent: 'test-agent'
        }
      },
      summary: 'Test project',
      ai_instructions: 'Test instructions',
      checksum: 'abc12345',
      compressed: false,
      size: 1000
    };
  });

  describe('FAF Content Copying', () => {
    it('should copy FAF content to clipboard', async () => {
      // Mock modern clipboard API
      Object.assign(navigator, {
        clipboard: {
          writeText: vi.fn().mockResolvedValue(undefined)
        }
      });

      await expect(ClipboardManager.copyFAFContent(mockFAF)).resolves.not.toThrow();
      expect(navigator.clipboard.writeText).toHaveBeenCalled();
    });

    it('should fallback to execCommand when clipboard API unavailable', async () => {
      // Remove clipboard API
      Object.assign(navigator, { clipboard: undefined });

      // Mock document.execCommand
      document.execCommand = vi.fn().mockReturnValue(true);
      
      // Mock document.body.appendChild/removeChild
      const mockAppendChild = vi.fn();
      const mockRemoveChild = vi.fn();
      Object.assign(document.body, {
        appendChild: mockAppendChild,
        removeChild: mockRemoveChild
      });

      await expect(ClipboardManager.copyFAFContent(mockFAF)).resolves.not.toThrow();
      expect(document.execCommand).toHaveBeenCalledWith('copy');
    });

    it('should handle clipboard permission errors', async () => {
      Object.assign(navigator, {
        clipboard: {
          writeText: vi.fn().mockRejectedValue(new DOMException('Permission denied', 'NotAllowedError'))
        }
      });

      await expect(ClipboardManager.copyFAFContent(mockFAF)).rejects.toThrow(ClipboardError);
    });
  });

  describe('Content Validation', () => {
    it('should validate FAF content structure', () => {
      expect(() => ClipboardManager.validateFAFContent(mockFAF)).not.toThrow();
    });

    it('should reject invalid FAF content', () => {
      const invalidFAF = { ...mockFAF, version: '' };
      expect(() => ClipboardManager.validateFAFContent(invalidFAF as any)).toThrow(ClipboardError);
    });

    it('should reject FAF without context', () => {
      const invalidFAF = { ...mockFAF, context: undefined };
      expect(() => ClipboardManager.validateFAFContent(invalidFAF as any)).toThrow(ClipboardError);
    });

    it('should reject invalid scores', () => {
      const invalidFAF = { ...mockFAF, score: 150 as Score };
      expect(() => ClipboardManager.validateFAFContent(invalidFAF)).toThrow(ClipboardError);
    });
  });

  describe('Content Preview', () => {
    it('should generate content preview', () => {
      const preview = ClipboardManager.getContentPreview(mockFAF);
      expect(typeof preview).toBe('string');
      expect(preview.length).toBeGreaterThan(0);
    });

    it('should truncate long content', () => {
      const preview = ClipboardManager.getContentPreview(mockFAF);
      expect(preview.length).toBeLessThanOrEqual(203); // 200 + "..."
    });
  });
});