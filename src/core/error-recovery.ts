/**
 * FAF Error Recovery Service
 * Automatic retry logic, fallback strategies, and graceful degradation
 */

import { 
  FAFError, 
  FAFErrorCode, 
  FAFErrorSeverity, 
  FAFRecoveryStrategy,
  ErrorUtils
} from '@/core/errors';
import { telemetry } from '@/core/telemetry';

export interface RetryConfig {
  readonly maxAttempts: number;
  readonly baseDelay: number;
  readonly maxDelay: number;
  readonly backoffFactor: number;
  readonly timeout?: number;
}

export const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxAttempts: 3,
  baseDelay: 1000,      // 1 second
  maxDelay: 10000,      // 10 seconds
  backoffFactor: 2,     // Exponential backoff
  timeout: 30000        // 30 second total timeout
};

/**
 * Error recovery service with intelligent retry logic and fallback strategies
 */
export class ErrorRecoveryService {
  private static instance: ErrorRecoveryService | null = null;
  private readonly retryAttempts = new Map<string, number>();
  private readonly retryTimers = new Map<string, NodeJS.Timeout>();

  static getInstance(): ErrorRecoveryService {
    if (!ErrorRecoveryService.instance) {
      ErrorRecoveryService.instance = new ErrorRecoveryService();
    }
    return ErrorRecoveryService.instance;
  }

  /**
   * Execute operation with automatic error recovery
   */
  async withRecovery<T>(
    operation: () => Promise<T>,
    options: {
      readonly operationId: string;
      readonly retryConfig?: Partial<RetryConfig>;
      readonly fallbackOperation?: () => Promise<T>;
      readonly context?: string;
    }
  ): Promise<T> {
    const { operationId, context = 'unknown' } = options;
    const config = { ...DEFAULT_RETRY_CONFIG, ...options.retryConfig };
    
    let lastError: FAFError | null = null;
    const startTime = Date.now();

    // Clear any existing retry timer for this operation
    this.clearRetryTimer(operationId);

    for (let attempt = 1; attempt <= config.maxAttempts; attempt++) {
      try {
        // Check global timeout
        if (config.timeout && (Date.now() - startTime) > config.timeout) {
          throw new FAFError(FAFErrorCode.EXTRACTION_TIMEOUT, 'Operation timeout exceeded', {
            context: { timestamp: Date.now() }
          });
        }

        // Execute the operation
        const result = await this.executeWithTimeout(operation, config.timeout);
        
        // Success - clear retry count and return
        this.retryAttempts.delete(operationId);
        
        // Track successful recovery if this wasn't the first attempt
        if (attempt > 1) {
          telemetry.track('error_boundary', {
            type: 'recovery_success',
            operationId,
            context,
            attemptsRequired: attempt,
            duration: Date.now() - startTime
          });
        }

        return result;

      } catch (error) {
        lastError = error instanceof FAFError ? error : FAFError.fromUnknown(error, {
          timestamp: Date.now()
        });

        console.warn(`[${context}] Attempt ${attempt}/${config.maxAttempts} failed:`, {
          error: lastError.code,
          message: lastError.message,
          severity: lastError.severity
        });

        // Track retry attempt
        this.retryAttempts.set(operationId, attempt);

        // Check if we should continue retrying
        if (!this.shouldRetry(lastError, attempt, config.maxAttempts)) {
          break;
        }

        // Calculate delay with jitter
        const delay = this.calculateDelay(attempt, config);
        
        // Wait before retry (if not the last attempt)
        if (attempt < config.maxAttempts) {
          await this.delay(delay);
        }
      }
    }

    // All retries exhausted - try fallback if available
    if (options.fallbackOperation) {
      try {
        console.log(`[${context}] Trying fallback operation after ${config.maxAttempts} failed attempts`);
        
        const fallbackResult = await options.fallbackOperation();
        
        // Track successful fallback
        telemetry.track('error_boundary', {
          type: 'fallback_success',
          operationId,
          context,
          originalError: lastError?.code,
          duration: Date.now() - startTime
        });

        return fallbackResult;

      } catch (fallbackError) {
        // Fallback also failed
        const fafFallbackError = fallbackError instanceof FAFError ? 
          fallbackError : 
          FAFError.fromUnknown(fallbackError, { timestamp: Date.now() });

        telemetry.track('error_boundary', {
          type: 'fallback_failed',
          operationId,
          context,
          originalError: lastError?.code,
          fallbackError: fafFallbackError.code,
          duration: Date.now() - startTime
        });

        // Throw the more severe of the two errors
        if (this.compareSeverity(fafFallbackError.severity, lastError?.severity || FAFErrorSeverity.LOW) >= 0) {
          throw fafFallbackError;
        }
      }
    }

    // No recovery possible - clean up and throw final error
    this.retryAttempts.delete(operationId);
    
    telemetry.track('error_boundary', {
      type: 'recovery_failed',
      operationId,
      context,
      finalError: lastError?.code,
      attemptsUsed: config.maxAttempts,
      duration: Date.now() - startTime
    });

    throw lastError || new FAFError(FAFErrorCode.UNKNOWN_ERROR, 'Operation failed after all recovery attempts');
  }

  /**
   * Handle error with automatic recovery suggestion
   */
  async handleError(
    error: unknown,
    context: {
      readonly operationId: string;
      readonly operationType: string;
      readonly userAction?: () => Promise<void>;
    }
  ): Promise<{
    readonly recovered: boolean;
    readonly suggestion: string;
    readonly actions: readonly string[];
  }> {
    const fafError = error instanceof FAFError ? error : FAFError.fromUnknown(error);
    
    // Track error occurrence
    telemetry.track('error_boundary', {
      type: 'error_handled',
      operationId: context.operationId,
      operationType: context.operationType,
      errorCode: fafError.code,
      severity: fafError.severity,
      recoveryStrategy: fafError.recoveryStrategy
    });

    // Determine recovery approach based on error type
    switch (fafError.recoveryStrategy) {
      case FAFRecoveryStrategy.RETRY:
        return {
          recovered: false,
          suggestion: 'This issue is usually temporary. Try the operation again.',
          actions: ['Retry now', 'Wait 30 seconds and retry', 'Refresh page and retry']
        };

      case FAFRecoveryStrategy.FALLBACK:
        return {
          recovered: await this.attemptFallbackRecovery(fafError, context),
          suggestion: 'Switched to alternative method due to the issue.',
          actions: ['Continue with limited functionality', 'Try full operation later', 'Check settings']
        };

      case FAFRecoveryStrategy.GRACEFUL_DEGRADATION:
        return {
          recovered: true,
          suggestion: 'Continuing with reduced functionality to work around the issue.',
          actions: ['Continue anyway', 'Try on different page', 'Report issue']
        };

      case FAFRecoveryStrategy.USER_ACTION_REQUIRED:
        return {
          recovered: false,
          suggestion: 'User action is required to resolve this issue.',
          actions: fafError.recoveryActions
        };

      case FAFRecoveryStrategy.RESTART_REQUIRED:
        return {
          recovered: false,
          suggestion: 'Extension restart is required to fix this issue.',
          actions: ['Restart browser', 'Reload extension', 'Check for updates']
        };

      default:
        return {
          recovered: false,
          suggestion: 'This error requires manual resolution.',
          actions: ['Try again later', 'Check browser console', 'Report issue']
        };
    }
  }

  /**
   * Get current retry count for an operation
   */
  getRetryCount(operationId: string): number {
    return this.retryAttempts.get(operationId) || 0;
  }

  /**
   * Clear retry state for an operation
   */
  clearRetryState(operationId: string): void {
    this.retryAttempts.delete(operationId);
    this.clearRetryTimer(operationId);
  }

  /**
   * Get recovery recommendations for an error
   */
  getRecoveryRecommendations(error: unknown): {
    readonly immediate: readonly string[];
    readonly followUp: readonly string[];
    readonly prevention: readonly string[];
  } {
    const fafError = error instanceof FAFError ? error : FAFError.fromUnknown(error);

    // Base recommendations by error category
    const errorCategory = this.categorizeError(fafError.code);
    
    switch (errorCategory) {
      case 'platform':
        return {
          immediate: ['Refresh the page', 'Wait for page to fully load', 'Try on supported platform'],
          followUp: ['Check internet connection', 'Clear browser cache', 'Update browser'],
          prevention: ['Use supported development platforms', 'Ensure stable internet connection']
        };

      case 'permissions':
        return {
          immediate: ['Check extension permissions', 'Grant required permissions', 'Reload extension'],
          followUp: ['Restart browser', 'Reinstall extension if needed'],
          prevention: ['Keep extension permissions up to date', 'Avoid revoking permissions']
        };

      case 'performance':
        return {
          immediate: ['Close unused tabs', 'Wait and retry', 'Reduce complexity'],
          followUp: ['Restart browser', 'Check system resources'],
          prevention: ['Limit concurrent operations', 'Use smaller code sections']
        };

      case 'network':
        return {
          immediate: ['Check internet connection', 'Retry in a moment', 'Try different network'],
          followUp: ['Clear browser cache', 'Disable VPN if used'],
          prevention: ['Use stable internet connection', 'Avoid peak usage times']
        };

      default:
        return {
          immediate: fafError.recoveryActions,
          followUp: ['Restart browser', 'Check for updates'],
          prevention: ['Keep extension updated', 'Use supported browsers']
        };
    }
  }

  private async executeWithTimeout<T>(
    operation: () => Promise<T>,
    timeout?: number
  ): Promise<T> {
    if (!timeout) {
      return operation();
    }

    return Promise.race([
      operation(),
      new Promise<never>((_, reject) => {
        setTimeout(() => {
          reject(new FAFError(FAFErrorCode.EXTRACTION_TIMEOUT, `Operation timed out after ${timeout}ms`));
        }, timeout);
      })
    ]);
  }

  private shouldRetry(error: FAFError, currentAttempt: number, maxAttempts: number): boolean {
    // Don't retry if we've hit max attempts
    if (currentAttempt >= maxAttempts) {
      return false;
    }

    // Don't retry critical errors or those that require user action
    if (error.severity === FAFErrorSeverity.CRITICAL || 
        error.recoveryStrategy === FAFRecoveryStrategy.USER_ACTION_REQUIRED ||
        error.recoveryStrategy === FAFRecoveryStrategy.NO_RECOVERY) {
      return false;
    }

    // Don't retry certain permanent errors
    const nonRetryableErrors = [
      FAFErrorCode.CHROME_PERMISSIONS_MISSING,
      FAFErrorCode.PLATFORM_NOT_SUPPORTED,
      FAFErrorCode.CONTENT_SCRIPT_CSP_VIOLATION
    ];

    return !nonRetryableErrors.includes(error.code);
  }

  private calculateDelay(attempt: number, config: RetryConfig): number {
    const baseDelay = config.baseDelay * Math.pow(config.backoffFactor, attempt - 1);
    const jitter = Math.random() * 0.1 * baseDelay; // 10% jitter
    return Math.min(baseDelay + jitter, config.maxDelay);
  }

  private async delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private clearRetryTimer(operationId: string): void {
    const timer = this.retryTimers.get(operationId);
    if (timer) {
      clearTimeout(timer);
      this.retryTimers.delete(operationId);
    }
  }

  private compareSeverity(severity1: FAFErrorSeverity, severity2: FAFErrorSeverity): number {
    const severityOrder = [
      FAFErrorSeverity.LOW,
      FAFErrorSeverity.MEDIUM, 
      FAFErrorSeverity.HIGH,
      FAFErrorSeverity.CRITICAL
    ];

    return severityOrder.indexOf(severity1) - severityOrder.indexOf(severity2);
  }

  private async attemptFallbackRecovery(
    error: FAFError,
    context: { readonly operationId: string; readonly operationType: string }
  ): Promise<boolean> {
    // Specific fallback strategies based on error type
    switch (error.code) {
      case FAFErrorCode.CLIPBOARD_PERMISSION_DENIED:
        // Could implement manual copy fallback
        return true;
        
      case FAFErrorCode.PLATFORM_DOM_ACCESS_DENIED:
        // Could implement alternative detection method
        return false; // Not implemented yet
        
      case FAFErrorCode.CHROME_STORAGE_QUOTA_EXCEEDED:
        // Could implement memory cleanup
        try {
          // Trigger storage cleanup (would need to be implemented)
          return true;
        } catch {
          return false;
        }
        
      default:
        return false;
    }
  }

  private categorizeError(code: FAFErrorCode): 'platform' | 'permissions' | 'performance' | 'network' | 'unknown' {
    if (code.includes('PLATFORM')) return 'platform';
    if (code.includes('PERMISSION') || code.includes('ACCESS')) return 'permissions';
    if (code.includes('TIMEOUT') || code.includes('MEMORY') || code.includes('QUOTA')) return 'performance';
    if (code.includes('NETWORK') || code.includes('REQUEST')) return 'network';
    return 'unknown';
  }
}

/**
 * Global error recovery instance
 */
export const errorRecovery = ErrorRecoveryService.getInstance();

/**
 * Decorator for automatic retry with error recovery
 */
export function withRetry<Args extends readonly any[], Return>(
  retryConfig: Partial<RetryConfig> = {},
  operationId?: string
) {
  return function(
    target: any,
    propertyName: string,
    descriptor: PropertyDescriptor
  ) {
    const method = descriptor.value;
    
    descriptor.value = async function(...args: Args): Promise<Return> {
      const id = operationId || `${target.constructor.name}.${propertyName}`;
      
      return errorRecovery.withRecovery(
        () => method.apply(this, args),
        {
          operationId: id,
          retryConfig,
          context: `${target.constructor.name}.${propertyName}`
        }
      );
    };

    return descriptor;
  };
}