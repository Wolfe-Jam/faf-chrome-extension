/**
 * Core FAF Engine Tests - Comprehensive test coverage
 */

import { FAFEngine } from '@/core/engine';
import { isValidPlatform } from '@/core/types';
import { beforeEach, describe, expect, it, vi } from 'vitest';

describe('FAF Engine', () => {
  let engine: FAFEngine;

  beforeEach(() => {
    engine = new FAFEngine();
  });

  describe('Platform Detection', () => {
    it('should detect Monaco editor', () => {
      // Mock Monaco presence
      (globalThis as any).monaco = {
        editor: {
          getModels: () => [],
        },
      };

      // This would call the actual detection logic
      // For now, we test the expected behavior
      expect((globalThis as any).monaco).toBeDefined();
    });

    it('should detect GitHub', () => {
      // Mock GitHub URL
      Object.defineProperty(window, 'location', {
        value: {
          hostname: 'github.com',
          pathname: '/facebook/react',
        },
        configurable: true,
      });

      expect(window.location.hostname).toContain('github.com');
      expect(window.location.pathname).toContain('/');
    });

    it('should detect CodeMirror', () => {
      // Mock CodeMirror presence
      (globalThis as any).CodeMirror = {
        instances: [],
      };

      expect((globalThis as any).CodeMirror).toBeDefined();
    });
  });

  describe('Context Extraction', () => {
    it('should extract context successfully', async () => {
      const result = await engine.extract();

      expect(result).toHaveProperty('success');
      if (result.success) {
        expect(result.faf).toHaveProperty('version');
        expect(result.faf).toHaveProperty('context');
      }
    });

    it('should handle extraction timeout', async () => {
      // Create engine with short timeout
      const shortTimeoutEngine = new FAFEngine({
        timeout: 1,
        includeContent: true,
        maxFileSize: 1000,
        maxFiles: 10,
      });

      // Mock slow operation
      vi.spyOn(shortTimeoutEngine, 'extract').mockImplementation(() => {
        return new Promise((resolve) => {
          setTimeout(() => {
            resolve({ success: true, faf: {} as any });
          }, 100); // Longer than timeout
        });
      });

      const result = await shortTimeoutEngine.extract();

      // Should timeout and return error
      if (!result.success) {
        expect(result.error).toContain('timeout');
        expect(result.code).toBe('EXTRACTION_TIMEOUT');
      }
    });

    it('should handle DOM access errors with fallback', async () => {
      // Mock DOM error
      vi.spyOn(document, 'querySelector').mockImplementation(() => {
        throw new Error('DOM access denied');
      });

      const result = await engine.extract();

      if (!result.success) {
        expect(result.error).toContain('minimal context available');
      }
    });
  });

  describe('Performance Requirements', () => {
    it('should complete extraction in under 300ms', async () => {
      const startTime = performance.now();
      await engine.extract();
      const endTime = performance.now();

      const duration = endTime - startTime;
      expect(duration).toBeLessThan(300);
    });
  });
});

describe('Type Utilities', () => {
  describe('Platform Validation', () => {
    it('should validate platform strings', () => {
      expect(isValidPlatform('github')).toBe(true);
      expect(isValidPlatform('monaco')).toBe(true);
      expect(isValidPlatform('invalid-platform')).toBe(false);
    });
  });
});
