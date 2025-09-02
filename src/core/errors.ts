/**
 * FAF Standardized Error Handling System
 * Centralized error types, recovery strategies, and user-friendly messaging
 */

import { telemetry } from '@/core/telemetry';
import type { Platform } from '@/core/types';

/**
 * Standard error codes for the entire FAF extension
 */
export enum FAFErrorCode {
  // Platform Detection Errors (1000-1099)
  PLATFORM_DETECTION_TIMEOUT = 'FAF_1001',
  PLATFORM_DETECTION_FAILED = 'FAF_1002', 
  PLATFORM_NOT_SUPPORTED = 'FAF_1003',
  PLATFORM_DOM_ACCESS_DENIED = 'FAF_1004',

  // Context Extraction Errors (1100-1199)
  EXTRACTION_TIMEOUT = 'FAF_1101',
  EXTRACTION_FAILED = 'FAF_1102',
  EXTRACTION_INVALID_DATA = 'FAF_1103',
  EXTRACTION_PERMISSION_DENIED = 'FAF_1104',
  EXTRACTION_RATE_LIMITED = 'FAF_1105',

  // Chrome API Errors (1200-1299)
  CHROME_TAB_ACCESS_DENIED = 'FAF_1201',
  CHROME_STORAGE_QUOTA_EXCEEDED = 'FAF_1202',
  CHROME_MESSAGING_FAILED = 'FAF_1203',
  CHROME_PERMISSIONS_MISSING = 'FAF_1204',
  CHROME_RUNTIME_ERROR = 'FAF_1205',
  CHROME_TAB_NOT_FOUND = 'FAF_1206',
  CHROME_API_UNAVAILABLE = 'FAF_1207',
  CHROME_MESSAGE_FAILED = 'FAF_1208',
  CHROME_SCRIPTING_FAILED = 'FAF_1209',
  CHROME_STORAGE_ERROR = 'FAF_1210',

  // Service Worker Errors (1300-1399)
  SERVICE_WORKER_INIT_FAILED = 'FAF_1301',
  SERVICE_WORKER_MESSAGE_FAILED = 'FAF_1302',
  SERVICE_WORKER_MEMORY_PRESSURE = 'FAF_1303',
  SERVICE_WORKER_TIMEOUT = 'FAF_1304',

  // UI/Popup Errors (1400-1499)
  POPUP_LOAD_FAILED = 'FAF_1401',
  POPUP_ACTION_FAILED = 'FAF_1402',
  POPUP_DATA_CORRUPT = 'FAF_1403',

  // Clipboard Errors (1500-1599)
  CLIPBOARD_PERMISSION_DENIED = 'FAF_1501',
  CLIPBOARD_WRITE_FAILED = 'FAF_1502',
  CLIPBOARD_DATA_TOO_LARGE = 'FAF_1503',

  // Network/Communication Errors (1600-1699)
  NETWORK_REQUEST_FAILED = 'FAF_1601',
  NETWORK_TIMEOUT = 'FAF_1602',
  NETWORK_RATE_LIMITED = 'FAF_1603',

  // Content Script Errors (1700-1799)
  CONTENT_SCRIPT_INJECTION_FAILED = 'FAF_1701',
  CONTENT_SCRIPT_DOM_BLOCKED = 'FAF_1702',
  CONTENT_SCRIPT_CSP_VIOLATION = 'FAF_1703',

  // General System Errors (1900-1999)
  UNKNOWN_ERROR = 'FAF_1901',
  SYSTEM_OVERLOAD = 'FAF_1902',
  CONFIGURATION_ERROR = 'FAF_1903',
  DEPENDENCY_ERROR = 'FAF_1904'
}

/**
 * Error severity levels for prioritization and handling
 */
export enum FAFErrorSeverity {
  LOW = 'low',         // Minor issues, extension still functional
  MEDIUM = 'medium',   // Significant issues, some features affected
  HIGH = 'high',       // Major issues, core functionality impaired
  CRITICAL = 'critical' // Extension largely unusable
}

/**
 * Error recovery strategies
 */
export enum FAFRecoveryStrategy {
  RETRY = 'retry',                    // Automatic retry with backoff
  FALLBACK = 'fallback',             // Switch to alternative method
  GRACEFUL_DEGRADATION = 'degrade',  // Continue with limited functionality  
  USER_ACTION_REQUIRED = 'user',     // User intervention needed
  RESTART_REQUIRED = 'restart',      // Extension restart needed
  NO_RECOVERY = 'none'               // Permanent failure
}

/**
 * Structured error information with context and recovery guidance
 */
export interface FAFErrorInfo {
  readonly code: FAFErrorCode;
  readonly severity: FAFErrorSeverity;
  readonly message: string;
  readonly userMessage: string;
  readonly technicalDetails?: string;
  readonly recoveryStrategy: FAFRecoveryStrategy;
  readonly recoveryActions: readonly string[];
  readonly context?: {
    readonly platform?: Platform;
    readonly url?: string;
    readonly userAgent?: string;
    readonly timestamp: number;
    readonly sessionId?: string;
  };
}

/**
 * Main FAF Error class with rich context and recovery information
 */
export class FAFError extends Error {
  readonly code: FAFErrorCode;
  readonly severity: FAFErrorSeverity;
  readonly userMessage: string;
  readonly technicalDetails?: string;
  readonly recoveryStrategy: FAFRecoveryStrategy;
  readonly recoveryActions: readonly string[];
  readonly context: FAFErrorInfo['context'];
  readonly timestamp: number;

  constructor(
    code: FAFErrorCode,
    message: string,
    options: {
      readonly cause?: Error;
      readonly userMessage?: string;
      readonly technicalDetails?: string;
      readonly context?: Partial<FAFErrorInfo['context']>;
    } = {}
  ) {
    super(message, { cause: options.cause });
    
    this.name = 'FAFError';
    this.code = code;
    this.timestamp = Date.now();
    
    // Get error details from registry
    const errorInfo = FAFErrorRegistry.getErrorInfo(code);
    this.severity = errorInfo.severity;
    this.recoveryStrategy = errorInfo.recoveryStrategy;
    this.recoveryActions = errorInfo.recoveryActions;
    
    // Use provided user message or default from registry
    this.userMessage = options.userMessage || errorInfo.userMessage;
    this.technicalDetails = options.technicalDetails;
    
    // Build context
    this.context = {
      timestamp: this.timestamp,
      platform: options.context?.platform,
      url: options.context?.url || (typeof window !== 'undefined' ? window.location.href : undefined),
      userAgent: options.context?.userAgent || (typeof navigator !== 'undefined' ? navigator.userAgent : undefined),
      sessionId: options.context?.sessionId
    };

    // Automatically track error in telemetry
    this.trackError();
  }

  /**
   * Create error from unknown error type with best-effort classification
   */
  static fromUnknown(error: unknown, context?: Partial<FAFErrorInfo['context']>): FAFError {
    if (error instanceof FAFError) {
      return error;
    }

    if (error instanceof Error) {
      // Try to classify common error types
      let code = FAFErrorCode.UNKNOWN_ERROR;
      
      if (error.message.includes('timeout')) {
        code = FAFErrorCode.EXTRACTION_TIMEOUT;
      } else if (error.message.includes('permission')) {
        code = FAFErrorCode.CHROME_PERMISSIONS_MISSING;
      } else if (error.message.includes('DOM') || error.message.includes('document')) {
        code = FAFErrorCode.PLATFORM_DOM_ACCESS_DENIED;
      } else if (error.message.includes('quota')) {
        code = FAFErrorCode.CHROME_STORAGE_QUOTA_EXCEEDED;
      }

      return new FAFError(code, error.message, {
        cause: error,
        technicalDetails: error.stack,
        context
      });
    }

    // Handle non-Error objects
    const message = typeof error === 'string' ? error : String(error);
    return new FAFError(FAFErrorCode.UNKNOWN_ERROR, message, { context });
  }

  /**
   * Check if error is recoverable
   */
  isRecoverable(): boolean {
    return this.recoveryStrategy !== FAFRecoveryStrategy.NO_RECOVERY;
  }

  /**
   * Check if error requires user action
   */
  requiresUserAction(): boolean {
    return this.recoveryStrategy === FAFRecoveryStrategy.USER_ACTION_REQUIRED;
  }

  /**
   * Get user-friendly error display information
   */
  getDisplayInfo(): {
    readonly title: string;
    readonly message: string;
    readonly actions: readonly string[];
    readonly severity: FAFErrorSeverity;
    readonly canRetry: boolean;
  } {
    return {
      title: this.getErrorTitle(),
      message: this.userMessage,
      actions: this.recoveryActions,
      severity: this.severity,
      canRetry: this.recoveryStrategy === FAFRecoveryStrategy.RETRY
    };
  }

  /**
   * Convert to serializable format for logging/telemetry
   */
  toJSON(): Record<string, any> {
    return {
      code: this.code,
      severity: this.severity,
      message: this.message,
      userMessage: this.userMessage,
      technicalDetails: this.technicalDetails,
      recoveryStrategy: this.recoveryStrategy,
      recoveryActions: this.recoveryActions,
      context: this.context,
      timestamp: this.timestamp,
      stack: this.stack
    };
  }

  private getErrorTitle(): string {
    const titles: Record<FAFErrorSeverity, string> = {
      [FAFErrorSeverity.LOW]: 'Minor Issue',
      [FAFErrorSeverity.MEDIUM]: 'Issue Detected', 
      [FAFErrorSeverity.HIGH]: 'Extraction Problem',
      [FAFErrorSeverity.CRITICAL]: 'Critical Error'
    };
    return titles[this.severity];
  }

  private trackError(): void {
    // Defer telemetry tracking to avoid circular dependencies
    // Telemetry will be tracked by error handling components instead
    try {
      // Simple console tracking for now to avoid circular dependency
      console.warn(`[FAF Error ${this.code}] ${this.severity}: ${this.message}`);
    } catch {
      // Silent fail - absolutely no exceptions from error tracking
    }
  }
}

/**
 * Registry of all error definitions with user messages and recovery strategies
 */
export class FAFErrorRegistry {
  private static readonly errorDefinitions: Map<FAFErrorCode, FAFErrorInfo> = new Map([
    // Platform Detection Errors
    [FAFErrorCode.PLATFORM_DETECTION_TIMEOUT, {
      code: FAFErrorCode.PLATFORM_DETECTION_TIMEOUT,
      severity: FAFErrorSeverity.MEDIUM,
      message: 'Platform detection timed out',
      userMessage: 'Unable to detect the current platform quickly enough. The page may be loading slowly.',
      recoveryStrategy: FAFRecoveryStrategy.RETRY,
      recoveryActions: ['Wait for page to load completely', 'Refresh the page', 'Try extraction again']
    }],

    [FAFErrorCode.PLATFORM_NOT_SUPPORTED, {
      code: FAFErrorCode.PLATFORM_NOT_SUPPORTED,
      severity: FAFErrorSeverity.MEDIUM,
      message: 'Platform is not supported',
      userMessage: 'This website is not currently supported by FAF. We support GitHub, Monaco Editor, CodeMirror, and other development platforms.',
      recoveryStrategy: FAFRecoveryStrategy.GRACEFUL_DEGRADATION,
      recoveryActions: ['Try on a supported platform', 'Copy code manually', 'Request platform support']
    }],

    [FAFErrorCode.PLATFORM_DOM_ACCESS_DENIED, {
      code: FAFErrorCode.PLATFORM_DOM_ACCESS_DENIED,
      severity: FAFErrorSeverity.HIGH,
      message: 'DOM access denied',
      userMessage: 'Cannot access page content due to security restrictions. This may be due to strict Content Security Policy.',
      recoveryStrategy: FAFRecoveryStrategy.USER_ACTION_REQUIRED,
      recoveryActions: ['Refresh the page', 'Check browser security settings', 'Try on a different page']
    }],

    // Extraction Errors
    [FAFErrorCode.EXTRACTION_TIMEOUT, {
      code: FAFErrorCode.EXTRACTION_TIMEOUT,
      severity: FAFErrorSeverity.MEDIUM,
      message: 'Context extraction timed out',
      userMessage: 'Extraction took longer than expected. The page may have complex content or be loading slowly.',
      recoveryStrategy: FAFRecoveryStrategy.RETRY,
      recoveryActions: ['Wait a moment and try again', 'Refresh the page', 'Check internet connection']
    }],

    [FAFErrorCode.EXTRACTION_PERMISSION_DENIED, {
      code: FAFErrorCode.EXTRACTION_PERMISSION_DENIED,
      severity: FAFErrorSeverity.HIGH,
      message: 'Permission denied for extraction',
      userMessage: 'FAF does not have permission to access this page. Please check extension permissions.',
      recoveryStrategy: FAFRecoveryStrategy.USER_ACTION_REQUIRED,
      recoveryActions: ['Check extension permissions in browser settings', 'Reload the extension', 'Refresh the page']
    }],

    // Chrome API Errors
    [FAFErrorCode.CHROME_TAB_ACCESS_DENIED, {
      code: FAFErrorCode.CHROME_TAB_ACCESS_DENIED,
      severity: FAFErrorSeverity.HIGH,
      message: 'Chrome tab access denied',
      userMessage: 'Cannot access the current tab. Please ensure FAF has the necessary permissions.',
      recoveryStrategy: FAFRecoveryStrategy.USER_ACTION_REQUIRED,
      recoveryActions: ['Grant tab permissions to FAF', 'Reload the extension', 'Check browser security settings']
    }],

    [FAFErrorCode.CHROME_STORAGE_QUOTA_EXCEEDED, {
      code: FAFErrorCode.CHROME_STORAGE_QUOTA_EXCEEDED,
      severity: FAFErrorSeverity.MEDIUM,
      message: 'Chrome storage quota exceeded',
      userMessage: 'Extension storage is full. Some data may not be saved.',
      recoveryStrategy: FAFRecoveryStrategy.FALLBACK,
      recoveryActions: ['Clear extension data', 'Restart browser', 'Continue without saving preferences']
    }],

    [FAFErrorCode.CHROME_PERMISSIONS_MISSING, {
      code: FAFErrorCode.CHROME_PERMISSIONS_MISSING,
      severity: FAFErrorSeverity.CRITICAL,
      message: 'Required Chrome permissions missing',
      userMessage: 'FAF is missing required permissions to function properly.',
      recoveryStrategy: FAFRecoveryStrategy.USER_ACTION_REQUIRED,
      recoveryActions: ['Go to chrome://extensions/', 'Find FAF extension', 'Grant required permissions']
    }],

    [FAFErrorCode.CHROME_TAB_NOT_FOUND, {
      code: FAFErrorCode.CHROME_TAB_NOT_FOUND,
      severity: FAFErrorSeverity.MEDIUM,
      message: 'No active tab found',
      userMessage: 'No active tab detected. Please open a supported page.',
      recoveryStrategy: FAFRecoveryStrategy.USER_ACTION_REQUIRED,
      recoveryActions: ['Open a supported website', 'Refresh the current page', 'Try a different tab']
    }],

    [FAFErrorCode.CHROME_API_UNAVAILABLE, {
      code: FAFErrorCode.CHROME_API_UNAVAILABLE,
      severity: FAFErrorSeverity.HIGH,
      message: 'Chrome API unavailable',
      userMessage: 'Chrome extension APIs are not available.',
      recoveryStrategy: FAFRecoveryStrategy.RESTART_REQUIRED,
      recoveryActions: ['Restart browser', 'Check Chrome version', 'Reinstall extension']
    }],

    [FAFErrorCode.CHROME_MESSAGE_FAILED, {
      code: FAFErrorCode.CHROME_MESSAGE_FAILED,
      severity: FAFErrorSeverity.MEDIUM,
      message: 'Chrome message failed',
      userMessage: 'Failed to communicate with the page. Please try again.',
      recoveryStrategy: FAFRecoveryStrategy.RETRY,
      recoveryActions: ['Try again', 'Refresh the page', 'Check page permissions']
    }],

    [FAFErrorCode.CHROME_SCRIPTING_FAILED, {
      code: FAFErrorCode.CHROME_SCRIPTING_FAILED,
      severity: FAFErrorSeverity.HIGH,
      message: 'Script injection failed',
      userMessage: 'Unable to inject required scripts into the page.',
      recoveryStrategy: FAFRecoveryStrategy.FALLBACK,
      recoveryActions: ['Refresh the page', 'Try a different page', 'Check site permissions']
    }],

    [FAFErrorCode.CHROME_STORAGE_ERROR, {
      code: FAFErrorCode.CHROME_STORAGE_ERROR,
      severity: FAFErrorSeverity.MEDIUM,
      message: 'Chrome storage error',
      userMessage: 'Unable to save data. Some features may not persist.',
      recoveryStrategy: FAFRecoveryStrategy.GRACEFUL_DEGRADATION,
      recoveryActions: ['Continue without saving', 'Clear extension data', 'Restart browser']
    }],

    // Service Worker Errors
    [FAFErrorCode.SERVICE_WORKER_INIT_FAILED, {
      code: FAFErrorCode.SERVICE_WORKER_INIT_FAILED,
      severity: FAFErrorSeverity.CRITICAL,
      message: 'Service worker initialization failed',
      userMessage: 'Extension background service failed to start. Please restart the browser.',
      recoveryStrategy: FAFRecoveryStrategy.RESTART_REQUIRED,
      recoveryActions: ['Restart browser', 'Reload extension', 'Check for browser updates']
    }],

    [FAFErrorCode.SERVICE_WORKER_MEMORY_PRESSURE, {
      code: FAFErrorCode.SERVICE_WORKER_MEMORY_PRESSURE,
      severity: FAFErrorSeverity.MEDIUM,
      message: 'Service worker under memory pressure',
      userMessage: 'Extension is using high memory. Performance may be affected.',
      recoveryStrategy: FAFRecoveryStrategy.GRACEFUL_DEGRADATION,
      recoveryActions: ['Close unused tabs', 'Restart browser', 'Limit concurrent extractions']
    }],

    // Clipboard Errors
    [FAFErrorCode.CLIPBOARD_PERMISSION_DENIED, {
      code: FAFErrorCode.CLIPBOARD_PERMISSION_DENIED,
      severity: FAFErrorSeverity.MEDIUM,
      message: 'Clipboard permission denied',
      userMessage: 'Cannot copy to clipboard automatically. You can copy the content manually.',
      recoveryStrategy: FAFRecoveryStrategy.FALLBACK,
      recoveryActions: ['Grant clipboard permission', 'Copy content manually', 'Use Ctrl+C to copy']
    }],

    [FAFErrorCode.CLIPBOARD_DATA_TOO_LARGE, {
      code: FAFErrorCode.CLIPBOARD_DATA_TOO_LARGE,
      severity: FAFErrorSeverity.LOW,
      message: 'Clipboard data too large',
      userMessage: 'The extracted content is too large for clipboard. Consider extracting smaller sections.',
      recoveryStrategy: FAFRecoveryStrategy.GRACEFUL_DEGRADATION,
      recoveryActions: ['Extract smaller code sections', 'Copy parts manually', 'Save to file instead']
    }],

    // Content Script Errors
    [FAFErrorCode.CONTENT_SCRIPT_CSP_VIOLATION, {
      code: FAFErrorCode.CONTENT_SCRIPT_CSP_VIOLATION,
      severity: FAFErrorSeverity.HIGH,
      message: 'Content Security Policy violation',
      userMessage: 'Page security settings prevent FAF from working. This is common on some secure sites.',
      recoveryStrategy: FAFRecoveryStrategy.GRACEFUL_DEGRADATION,
      recoveryActions: ['Try on a different page', 'Use manual copy instead', 'Contact site administrator']
    }],

    // Unknown Error
    [FAFErrorCode.UNKNOWN_ERROR, {
      code: FAFErrorCode.UNKNOWN_ERROR,
      severity: FAFErrorSeverity.MEDIUM,
      message: 'An unexpected error occurred',
      userMessage: 'Something unexpected happened. Please try again or restart the browser.',
      recoveryStrategy: FAFRecoveryStrategy.RETRY,
      recoveryActions: ['Try the action again', 'Refresh the page', 'Restart browser if issues persist']
    }]
  ]);

  static getErrorInfo(code: FAFErrorCode): FAFErrorInfo {
    const info = this.errorDefinitions.get(code);
    if (!info) {
      // Return default error info for unknown codes
      return {
        code,
        severity: FAFErrorSeverity.MEDIUM,
        message: 'Unknown error',
        userMessage: 'An unknown error occurred. Please try again.',
        recoveryStrategy: FAFRecoveryStrategy.RETRY,
        recoveryActions: ['Try again', 'Restart extension']
      };
    }
    return info;
  }

  static getAllErrorCodes(): readonly FAFErrorCode[] {
    return Array.from(this.errorDefinitions.keys());
  }
}

/**
 * Error boundary decorator for automatic error handling
 */
export function withErrorBoundary<Args extends readonly any[], Return>(
  fn: (...args: Args) => Return | Promise<Return>,
  context?: string
): (...args: Args) => Promise<Return> {
  return async (...args: Args): Promise<Return> => {
    try {
      const result = await fn(...args);
      return result;
    } catch (error) {
      const fafError = FAFError.fromUnknown(error, {
        platform: undefined, // Could be enhanced with context
        sessionId: undefined // Could be enhanced with session tracking
      });

      // Log with context if provided
      if (context) {
        console.error(`[${context}] FAF Error:`, fafError.toJSON());
      }

      throw fafError;
    }
  };
}

/**
 * Utility functions for error handling
 */
export const ErrorUtils = {
  /**
   * Check if an error is a specific FAF error code
   */
  isErrorCode(error: unknown, code: FAFErrorCode): error is FAFError {
    return error instanceof FAFError && error.code === code;
  },

  /**
   * Check if error is of specific severity
   */
  isErrorSeverity(error: unknown, severity: FAFErrorSeverity): error is FAFError {
    return error instanceof FAFError && error.severity === severity;
  },

  /**
   * Get user-friendly error message from any error
   */
  getUserMessage(error: unknown): string {
    if (error instanceof FAFError) {
      return error.userMessage;
    }
    if (error instanceof Error) {
      return 'An unexpected error occurred. Please try again.';
    }
    return 'Something went wrong. Please try again.';
  },

  /**
   * Check if error should be retried
   */
  shouldRetry(error: unknown): boolean {
    if (error instanceof FAFError) {
      return error.recoveryStrategy === FAFRecoveryStrategy.RETRY;
    }
    return false; // Conservative approach for unknown errors
  },

  /**
   * Get recovery actions for an error
   */
  getRecoveryActions(error: unknown): readonly string[] {
    if (error instanceof FAFError) {
      return error.recoveryActions;
    }
    return ['Try again', 'Refresh the page'];
  }
};