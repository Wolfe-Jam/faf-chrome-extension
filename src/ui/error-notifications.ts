/**
 * FAF Error Notification System
 * User-friendly error display with recovery guidance
 */

import { 
  FAFError, 
  FAFErrorSeverity, 
  ErrorUtils 
} from '@/core/errors';
import { errorRecovery } from '@/core/error-recovery';
import { ChromeNotifications } from '@/adapters/chrome';
import { telemetry } from '@/core/telemetry';

export interface ErrorNotificationOptions {
  readonly showNotification?: boolean;
  readonly showInPopup?: boolean;
  readonly showInConsole?: boolean;
  readonly autoRetry?: boolean;
  readonly retryDelay?: number;
}

export const DEFAULT_NOTIFICATION_OPTIONS: ErrorNotificationOptions = {
  showNotification: true,
  showInPopup: false,
  showInConsole: true,
  autoRetry: false,
  retryDelay: 5000
};

/**
 * Error notification display service with user-friendly messaging
 */
export class ErrorNotificationService {
  private static instance: ErrorNotificationService | null = null;
  private readonly activeNotifications = new Set<string>();
  private readonly userDismissals = new Set<string>();

  static getInstance(): ErrorNotificationService {
    if (!ErrorNotificationService.instance) {
      ErrorNotificationService.instance = new ErrorNotificationService();
    }
    return ErrorNotificationService.instance;
  }

  /**
   * Display error notification with recovery options
   */
  async showError(
    error: unknown,
    context: {
      readonly operationId: string;
      readonly operationType: string;
      readonly retryOperation?: () => Promise<void>;
    },
    options: ErrorNotificationOptions = DEFAULT_NOTIFICATION_OPTIONS
  ): Promise<void> {
    const fafError = error instanceof FAFError ? error : FAFError.fromUnknown(error);
    const displayInfo = fafError.getDisplayInfo();
    const notificationId = `${context.operationId}_${fafError.code}`;

    // Skip if user has dismissed this error type recently
    if (this.userDismissals.has(fafError.code)) {
      return;
    }

    // Prevent duplicate notifications
    if (this.activeNotifications.has(notificationId)) {
      return;
    }

    this.activeNotifications.add(notificationId);

    try {
      // Show browser notification if enabled and appropriate
      if (options.showNotification && this.shouldShowNotification(fafError)) {
        await this.showBrowserNotification(fafError, displayInfo, context);
      }

      // Show console error if enabled
      if (options.showInConsole) {
        this.showConsoleError(fafError, displayInfo, context);
      }

      // Handle auto-retry if enabled and appropriate
      if (options.autoRetry && displayInfo.canRetry && context.retryOperation) {
        await this.handleAutoRetry(fafError, context, options);
      }

      // Track notification display
      telemetry.track('error_boundary', {
        type: 'error_notification_shown',
        errorCode: fafError.code,
        severity: fafError.severity,
        operationId: context.operationId,
        operationType: context.operationType,
        notificationMethod: this.getNotificationMethods(options)
      });

    } finally {
      // Clean up notification tracking
      setTimeout(() => {
        this.activeNotifications.delete(notificationId);
      }, 30000); // Remove after 30 seconds
    }
  }

  /**
   * Show success recovery notification
   */
  async showRecoverySuccess(
    operationId: string,
    message: string = 'Issue resolved successfully!'
  ): Promise<void> {
    try {
      await ChromeNotifications.create(
        'FAF - Recovered ✅',
        message,
        'icons/success-128.png'
      );

      telemetry.track('error_boundary', {
        type: 'recovery_success_notification',
        operationId,
        message
      });

    } catch (error) {
      console.warn('Failed to show recovery success notification:', error);
    }
  }

  /**
   * Display error in popup interface
   */
  displayInPopup(error: unknown): {
    readonly title: string;
    readonly message: string;
    readonly severity: FAFErrorSeverity;
    readonly actions: readonly ErrorAction[];
    readonly canRetry: boolean;
  } {
    const fafError = error instanceof FAFError ? error : FAFError.fromUnknown(error);
    const displayInfo = fafError.getDisplayInfo();
    const recommendations = errorRecovery.getRecoveryRecommendations(fafError);

    return {
      title: displayInfo.title,
      message: displayInfo.message,
      severity: displayInfo.severity,
      canRetry: displayInfo.canRetry,
      actions: this.createErrorActions(fafError, recommendations)
    };
  }

  /**
   * Dismiss error notifications for a specific error code
   */
  dismissErrorType(errorCode: string): void {
    this.userDismissals.add(errorCode);
    
    // Auto-clear dismissal after 1 hour
    setTimeout(() => {
      this.userDismissals.delete(errorCode);
    }, 3600000);

    telemetry.track('user_action', {
      action: 'error_dismissed',
      errorCode
    });
  }

  /**
   * Clear all active notifications
   */
  clearAll(): void {
    this.activeNotifications.clear();
    this.userDismissals.clear();
  }

  /**
   * Get current notification state for debugging
   */
  getNotificationState(): {
    readonly activeCount: number;
    readonly dismissedCount: number;
    readonly activeNotifications: readonly string[];
  } {
    return {
      activeCount: this.activeNotifications.size,
      dismissedCount: this.userDismissals.size,
      activeNotifications: Array.from(this.activeNotifications)
    };
  }

  private shouldShowNotification(error: FAFError): boolean {
    // Don't show notifications for low severity errors
    if (error.severity === FAFErrorSeverity.LOW) {
      return false;
    }

    // Don't show notifications for certain error types that are expected
    const silentErrors = [
      'FAF_1003', // PLATFORM_NOT_SUPPORTED
      'FAF_1503'  // CLIPBOARD_DATA_TOO_LARGE
    ];

    return !silentErrors.includes(error.code);
  }

  private async showBrowserNotification(
    error: FAFError,
    displayInfo: ReturnType<FAFError['getDisplayInfo']>,
    context: { readonly operationId: string; readonly operationType: string }
  ): Promise<void> {
    try {
      const icon = this.getNotificationIcon(error.severity);
      const title = `FAF - ${displayInfo.title}`;
      
      // Truncate message for notification
      const message = displayInfo.message.length > 100 
        ? `${displayInfo.message.substring(0, 97)}...`
        : displayInfo.message;

      await ChromeNotifications.create(title, message, icon);

    } catch (notificationError) {
      console.warn('Failed to show browser notification:', notificationError);
      // Don't throw - notification failure shouldn't break error handling
    }
  }

  private showConsoleError(
    error: FAFError,
    displayInfo: ReturnType<FAFError['getDisplayInfo']>,
    context: { readonly operationId: string; readonly operationType: string }
  ): void {
    const consoleMethod = this.getConsoleMethod(error.severity);
    const prefix = `[FAF ${context.operationType}]`;
    
    consoleMethod(`${prefix} ${error.code}: ${error.message}`, {
      userMessage: displayInfo.message,
      severity: error.severity,
      recoveryActions: displayInfo.actions,
      context: error.context,
      operationId: context.operationId
    });
  }

  private async handleAutoRetry(
    error: FAFError,
    context: { 
      readonly operationId: string; 
      readonly retryOperation?: () => Promise<void>; 
    },
    options: ErrorNotificationOptions
  ): Promise<void> {
    if (!context.retryOperation || !options.retryDelay) {
      return;
    }

    // Wait for retry delay
    await new Promise(resolve => setTimeout(resolve, options.retryDelay));

    try {
      console.log(`[FAF Auto-Retry] Attempting to retry ${context.operationId}...`);
      await context.retryOperation();
      
      // Show success notification on auto-recovery
      await this.showRecoverySuccess(context.operationId, 'Auto-retry successful!');

    } catch (retryError) {
      console.warn(`[FAF Auto-Retry] Retry failed for ${context.operationId}:`, retryError);
      // Don't show another error notification for the retry failure
    }
  }

  private createErrorActions(
    error: FAFError,
    recommendations: ReturnType<typeof errorRecovery.getRecoveryRecommendations>
  ): readonly ErrorAction[] {
    const actions: ErrorAction[] = [];

    // Add immediate actions
    recommendations.immediate.forEach((action, index) => {
      actions.push({
        id: `immediate_${index}`,
        label: action,
        type: 'primary',
        priority: 'high'
      });
    });

    // Add follow-up actions
    recommendations.followUp.slice(0, 2).forEach((action, index) => {
      actions.push({
        id: `followup_${index}`,
        label: action,
        type: 'secondary',
        priority: 'medium'
      });
    });

    // Add dismiss action
    actions.push({
      id: 'dismiss',
      label: 'Dismiss',
      type: 'secondary',
      priority: 'low'
    });

    return actions;
  }

  private getNotificationIcon(severity: FAFErrorSeverity): string {
    const icons: Record<FAFErrorSeverity, string> = {
      [FAFErrorSeverity.LOW]: 'icons/info-128.png',
      [FAFErrorSeverity.MEDIUM]: 'icons/warning-128.png',
      [FAFErrorSeverity.HIGH]: 'icons/error-128.png',
      [FAFErrorSeverity.CRITICAL]: 'icons/critical-128.png'
    };

    return icons[severity] || 'icons/warning-128.png';
  }

  private getConsoleMethod(severity: FAFErrorSeverity): typeof console.log {
    switch (severity) {
      case FAFErrorSeverity.LOW:
        return console.info;
      case FAFErrorSeverity.MEDIUM:
        return console.warn;
      case FAFErrorSeverity.HIGH:
      case FAFErrorSeverity.CRITICAL:
        return console.error;
      default:
        return console.log;
    }
  }

  private getNotificationMethods(options: ErrorNotificationOptions): string[] {
    const methods: string[] = [];
    if (options.showNotification) methods.push('browser_notification');
    if (options.showInPopup) methods.push('popup');
    if (options.showInConsole) methods.push('console');
    return methods;
  }
}

export interface ErrorAction {
  readonly id: string;
  readonly label: string;
  readonly type: 'primary' | 'secondary' | 'destructive';
  readonly priority: 'high' | 'medium' | 'low';
}

/**
 * Global error notification instance
 */
export const errorNotifications = ErrorNotificationService.getInstance();

/**
 * Convenience function for showing errors
 */
export async function showError(
  error: unknown,
  context: {
    readonly operationId: string;
    readonly operationType: string;
    readonly retryOperation?: () => Promise<void>;
  },
  options?: ErrorNotificationOptions
): Promise<void> {
  return errorNotifications.showError(error, context, options);
}

/**
 * Convenience function for handling errors with automatic recovery
 */
export async function handleErrorWithRecovery<T>(
  operation: () => Promise<T>,
  context: {
    readonly operationId: string;
    readonly operationType: string;
    readonly fallback?: () => Promise<T>;
  },
  notificationOptions?: ErrorNotificationOptions
): Promise<T> {
  try {
    return await errorRecovery.withRecovery(operation, {
      operationId: context.operationId,
      context: context.operationType,
      fallbackOperation: context.fallback
    });

  } catch (error) {
    // Show error notification
    await showError(error, {
      operationId: context.operationId,
      operationType: context.operationType,
      retryOperation: async () => {
        const result = await operation();
        await errorNotifications.showRecoverySuccess(context.operationId);
        return result;
      }
    }, notificationOptions);

    throw error;
  }
}