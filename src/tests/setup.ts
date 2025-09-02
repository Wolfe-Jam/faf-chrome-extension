/**
 * Vitest Test Setup - Chrome Extension Mocks and Global Test Configuration
 */

import { beforeAll, afterEach, vi } from 'vitest';

// Mock Chrome APIs globally
const mockChrome = {
  tabs: {
    query: vi.fn().mockResolvedValue([{ id: 1, url: 'https://github.com/test', active: true }]),
    sendMessage: vi.fn().mockResolvedValue(undefined),
    get: vi.fn().mockResolvedValue({ id: 1, url: 'https://github.com/test' })
  },
  
  storage: {
    local: {
      get: vi.fn().mockResolvedValue({}),
      set: vi.fn().mockResolvedValue(undefined),
      clear: vi.fn().mockResolvedValue(undefined)
    }
  },
  
  action: {
    setBadgeText: vi.fn().mockResolvedValue(undefined),
    setBadgeBackgroundColor: vi.fn().mockResolvedValue(undefined)
  },
  
  notifications: {
    create: vi.fn().mockResolvedValue('notification-id')
  },
  
  runtime: {
    sendMessage: vi.fn(),
    connect: vi.fn().mockReturnValue({
      postMessage: vi.fn(),
      disconnect: vi.fn(),
      onMessage: { addListener: vi.fn() },
      onDisconnect: { addListener: vi.fn() }
    }),
    onMessage: {
      addListener: vi.fn()
    },
    onInstalled: {
      addListener: vi.fn()
    },
    getManifest: vi.fn().mockReturnValue({ version: '1.0.0' }),
    lastError: null
  },
  
  commands: {
    onCommand: {
      addListener: vi.fn()
    }
  },
  
  scripting: {
    executeScript: vi.fn().mockResolvedValue([])
  }
};

// Make chrome available globally
(global as any).chrome = mockChrome;

// Mock window object for browser environment
Object.defineProperty(window, 'location', {
  value: {
    hostname: 'github.com',
    pathname: '/facebook/react',
    href: 'https://github.com/facebook/react'
  },
  writable: true
});

// Mock performance API
Object.defineProperty(window, 'performance', {
  value: {
    now: vi.fn(() => Date.now()),
    mark: vi.fn(),
    measure: vi.fn(),
    getEntriesByName: vi.fn(() => []),
    clearMarks: vi.fn(),
    clearMeasures: vi.fn()
  }
});

// Mock navigator
Object.defineProperty(window, 'navigator', {
  value: {
    userAgent: 'Mozilla/5.0 (Chrome Test)',
    clipboard: {
      writeText: vi.fn().mockResolvedValue(undefined)
    }
  }
});

// Mock document.execCommand for clipboard fallback
document.execCommand = vi.fn().mockReturnValue(true);

// Mock telemetry globally
vi.mock('@/core/telemetry', () => ({
  telemetry: {
    track: vi.fn().mockResolvedValue(undefined),
    trackExtraction: vi.fn().mockResolvedValue(undefined),
    trackUserEvent: vi.fn().mockResolvedValue(undefined),
    recordMetric: vi.fn().mockResolvedValue(undefined),
    reportError: vi.fn().mockResolvedValue(undefined),
    addBreadcrumb: vi.fn(),
    setUserId: vi.fn(),
    startTimer: vi.fn(() => vi.fn()),
    trackMemoryUsage: vi.fn(),
    trackNetworkRequest: vi.fn()
  },
  trackPerformance: vi.fn().mockImplementation(async (name, operation) => {
    return await operation();
  }),
  ProductionTelemetry: vi.fn(),
  type: {
    TelemetryConfig: vi.fn(),
    PerformanceMetric: vi.fn(),
    ErrorReport: vi.fn(),
    UserEvent: vi.fn()
  }
}));

// Mock ResizeObserver (often needed for React components)
global.ResizeObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn()
}));

beforeAll(() => {
  // Additional setup before all tests
  console.log('🧪 Test environment initialized with Chrome API mocks');
});

afterEach(() => {
  // Reset all mocks after each test
  vi.clearAllMocks();
  
  // Reset chrome mock state
  (global as any).chrome.runtime.lastError = null;
});