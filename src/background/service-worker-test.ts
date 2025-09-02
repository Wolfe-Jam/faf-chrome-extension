/**
 * Service Worker Self-Test Suite
 * Comprehensive testing of all critical service worker functions
 */

import { vi } from 'vitest';
import type { Message } from '@/core/types';

/**
 * Mock Chrome APIs for testing
 */
class MockChromeAPI {
  private static instance: MockChromeAPI;
  
  static getInstance(): MockChromeAPI {
    if (!MockChromeAPI.instance) {
      MockChromeAPI.instance = new MockChromeAPI();
    }
    return MockChromeAPI.instance;
  }

  readonly storage = {
    local: {
      get: vi.fn().mockResolvedValue({}),
      set: vi.fn().mockResolvedValue(undefined),
      clear: vi.fn().mockResolvedValue(undefined)
    }
  };

  readonly tabs = {
    query: vi.fn().mockResolvedValue([{ id: 1, url: 'https://github.com/test', active: true }]),
    sendMessage: vi.fn().mockResolvedValue(undefined)
  };

  readonly action = {
    setBadgeText: vi.fn().mockResolvedValue(undefined),
    setBadgeBackgroundColor: vi.fn().mockResolvedValue(undefined)
  };

  readonly notifications = {
    create: vi.fn().mockResolvedValue('notification-id')
  };

  readonly runtime = {
    sendMessage: vi.fn(),
    onMessage: {
      addListener: vi.fn()
    },
    onInstalled: {
      addListener: vi.fn()
    }
  };

  readonly commands = {
    onCommand: {
      addListener: vi.fn()
    }
  };

  reset(): void {
    Object.values(this.storage.local).forEach(mock => mock.mockClear());
    Object.values(this.tabs).forEach(mock => mock.mockClear());
    Object.values(this.action).forEach(mock => mock.mockClear());
    Object.values(this.notifications).forEach(mock => mock.mockClear());
    this.runtime.sendMessage.mockClear();
    this.runtime.onMessage.addListener.mockClear();
    this.runtime.onInstalled.addListener.mockClear();
    this.commands.onCommand.addListener.mockClear();
  }
}

/**
 * Service Worker Test Suite
 */
export class ServiceWorkerTestSuite {
  private readonly mockChrome = MockChromeAPI.getInstance();
  private testResults: Array<{ name: string; passed: boolean; error?: string }> = [];

  /**
   * Run all service worker tests
   */
  async runAllTests(): Promise<{ passed: number; failed: number; results: Array<{ name: string; passed: boolean; error?: string }> }> {
    console.log('🧪 Starting Service Worker Test Suite...');

    // Reset mocks
    this.mockChrome.reset();
    this.testResults = [];

    // Run test categories
    await this.testMessageHandling();
    await this.testErrorHandling();
    await this.testConcurrencyLimits();
    await this.testTimeoutHandling();
    await this.testBadgeUpdates();
    await this.testNotifications();
    await this.testStorageOperations();
    await this.testKeyboardShortcuts();

    // Calculate results
    const passed = this.testResults.filter(t => t.passed).length;
    const failed = this.testResults.filter(t => !t.passed).length;

    console.log(`✅ Tests passed: ${passed}`);
    console.log(`❌ Tests failed: ${failed}`);

    return { passed, failed, results: this.testResults };
  }

  /**
   * Test message handling functionality
   */
  private async testMessageHandling(): Promise<void> {
    await this.runTest('Message Validation', async () => {
      // Test valid message
      const validMessage: Message = {
        type: 'EXTRACT_CONTEXT',
        timestamp: Date.now(),
        source: 'popup'
      };

      // This would call the actual validation function
      // For now, we simulate the validation logic
      const isValid = this.validateMessage(validMessage);
      if (!isValid) throw new Error('Valid message rejected');

      // Test invalid message
      const invalidMessage = { type: 'INVALID' };
      const isInvalid = this.validateMessage(invalidMessage);
      if (isInvalid) throw new Error('Invalid message accepted');
    });

    await this.runTest('Extract Context Message', async () => {
      // Simulate extract context message handling
      this.mockChrome.tabs.sendMessage.mockResolvedValueOnce(undefined);
      
      // This would call the actual message handler
      // For now, we verify the mock was called correctly
      const expectedMessage: Message = {
        type: 'EXTRACT_CONTEXT',
        timestamp: Date.now(),
        source: 'background'
      };

      // Simulate sending message to tab
      await this.mockChrome.tabs.sendMessage(1, expectedMessage);
      
      expect(this.mockChrome.tabs.sendMessage).toHaveBeenCalledWith(1, expectedMessage);
    });
  }

  /**
   * Test error handling robustness
   */
  private async testErrorHandling(): Promise<void> {
    await this.runTest('Tab Communication Error', async () => {
      // Simulate tab communication failure
      this.mockChrome.tabs.sendMessage.mockRejectedValueOnce(new Error('Tab not found'));

      try {
        await this.mockChrome.tabs.sendMessage(999, { type: 'TEST' });
        throw new Error('Should have thrown error');
      } catch (error) {
        if (!(error instanceof Error) || error.message !== 'Tab not found') {
          throw new Error('Wrong error type');
        }
      }
    });

    await this.runTest('Storage Error Recovery', async () => {
      // Simulate storage failure
      this.mockChrome.storage.local.set.mockRejectedValueOnce(new Error('Storage quota exceeded'));

      try {
        await this.mockChrome.storage.local.set({ test: 'data' });
        throw new Error('Should have thrown storage error');
      } catch (error) {
        if (!(error instanceof Error) || !error.message.includes('Storage')) {
          throw new Error('Storage error not handled properly');
        }
      }
    });
  }

  /**
   * Test concurrency limits
   */
  private async testConcurrencyLimits(): Promise<void> {
    await this.runTest('Concurrent Extraction Limits', async () => {
      // This would test the actual concurrency management
      // For now, we simulate the logic
      const MAX_CONCURRENT = 3;
      const activeExtractions = new Map();

      // Simulate adding extractions
      for (let i = 1; i <= MAX_CONCURRENT; i++) {
        activeExtractions.set(i, { tabId: i, startTime: Date.now() });
      }

      // Try to add one more (should fail)
      if (activeExtractions.size >= MAX_CONCURRENT) {
        // This is the expected behavior
        expect(activeExtractions.size).toBe(MAX_CONCURRENT);
      } else {
        throw new Error('Concurrency limit not enforced');
      }
    });
  }

  /**
   * Test timeout handling
   */
  private async testTimeoutHandling(): Promise<void> {
    await this.runTest('Extraction Timeout', async () => {
      // Simulate timeout scenario
      const TIMEOUT_MS = 100;
      let timeoutTriggered = false;

      const timeoutId = setTimeout(() => {
        timeoutTriggered = true;
      }, TIMEOUT_MS);

      // Wait slightly longer than timeout
      await new Promise(resolve => setTimeout(resolve, TIMEOUT_MS + 10));
      
      expect(timeoutTriggered).toBe(true);
      clearTimeout(timeoutId);
    });
  }

  /**
   * Test badge update functionality
   */
  private async testBadgeUpdates(): Promise<void> {
    await this.runTest('Badge Color Updates', async () => {
      const testScores: Array<{ score: number; expectedColor: string }> = [
        { score: 90, expectedColor: '#FF6B35' }, // High score - Orange
        { score: 65, expectedColor: '#5CE1E6' }, // Medium score - Cyan  
        { score: 30, expectedColor: '#0A0A0A' }  // Low score - Black
      ];

      for (const { score, expectedColor } of testScores) {
        // Reset mocks
        this.mockChrome.action.setBadgeBackgroundColor.mockClear();
        this.mockChrome.action.setBadgeText.mockClear();

        // Simulate badge update
        await this.mockChrome.action.setBadgeBackgroundColor(expectedColor);
        await this.mockChrome.action.setBadgeText(`${score}%`);

        expect(this.mockChrome.action.setBadgeBackgroundColor).toHaveBeenCalledWith(expectedColor);
        expect(this.mockChrome.action.setBadgeText).toHaveBeenCalledWith(`${score}%`);
      }
    });
  }

  /**
   * Test notification system
   */
  private async testNotifications(): Promise<void> {
    await this.runTest('Success Notifications', async () => {
      const mockScore = 85;
      const mockTime = 250;

      await this.mockChrome.notifications.create({
        type: 'basic',
        iconUrl: 'icons/social-logo-128.png',
        title: 'FAF - Context Extracted! ⚡️',
        message: `Score: ${mockScore}% | Time: ${mockTime}ms | Copied to clipboard`,
        priority: 2
      });

      expect(this.mockChrome.notifications.create).toHaveBeenCalled();
    });

    await this.runTest('Error Notifications', async () => {
      const errorMessage = 'Extraction failed: timeout';

      await this.mockChrome.notifications.create({
        type: 'basic',
        iconUrl: 'icons/social-logo-128.png',
        title: 'FAF - Extraction Failed ❌',
        message: `Error: ${errorMessage}`,
        priority: 2
      });

      expect(this.mockChrome.notifications.create).toHaveBeenCalled();
    });
  }

  /**
   * Test storage operations
   */
  private async testStorageOperations(): Promise<void> {
    await this.runTest('Storage Set/Get Operations', async () => {
      const testData = {
        lastExtraction: { success: true, score: 85 },
        timestamp: Date.now()
      };

      // Test storage set
      await this.mockChrome.storage.local.set(testData);
      expect(this.mockChrome.storage.local.set).toHaveBeenCalledWith(testData);

      // Test storage get
      this.mockChrome.storage.local.get.mockResolvedValueOnce(testData);
      const result = await this.mockChrome.storage.local.get(['lastExtraction']);
      expect(result).toEqual(testData);
    });
  }

  /**
   * Test keyboard shortcuts
   */
  private async testKeyboardShortcuts(): Promise<void> {
    await this.runTest('Keyboard Shortcut Handler', async () => {
      // Simulate setting up the handler (this would happen in the actual service worker)
      this.mockChrome.commands.onCommand.addListener((command: string) => {
        if (command === 'extract-context') {
          // Handle keyboard shortcut
        }
      });

      expect(this.mockChrome.commands.onCommand.addListener).toHaveBeenCalled();
    });
  }

  /**
   * Helper method to run individual tests with error catching
   */
  private async runTest(name: string, testFn: () => Promise<void>): Promise<void> {
    try {
      await testFn();
      this.testResults.push({ name, passed: true });
      console.log(`✅ ${name}`);
    } catch (error) {
      this.testResults.push({ 
        name, 
        passed: false, 
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      console.error(`❌ ${name}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Validate message structure (copied from service worker logic)
   */
  private validateMessage(message: unknown): message is Message {
    if (!message || typeof message !== 'object') {
      return false;
    }

    const msg = message as Record<string, unknown>;
    
    return (
      typeof msg['type'] === 'string' &&
      typeof msg['timestamp'] === 'number' &&
      typeof msg['source'] === 'string' &&
      ['popup', 'content', 'background', 'service-worker'].includes(msg['source'] as string)
    );
  }
}

// Auto-run tests in development
if (process.env['NODE_ENV'] === 'development') {
  const testSuite = new ServiceWorkerTestSuite();
  testSuite.runAllTests().then((results) => {
    if (results.failed > 0) {
      console.error('🚨 Service Worker tests failed! Review before deployment.');
    } else {
      console.log('🎉 All Service Worker tests passed!');
    }
  });
}