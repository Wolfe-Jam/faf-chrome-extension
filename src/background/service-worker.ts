/**
 * FAF Service Worker - Mission-Critical Background Coordinator
 * Bulletproof error handling, comprehensive edge case coverage, optimal service level
 */

import type { 
  Message, 
  ContextExtractedMessage, 
  ExtractContextMessage,
  ErrorMessage,
  ExtractionResult,
  Score
} from '@/core/types';

import { 
  ChromeTabs, 
  ChromeStorageAPI, 
  ChromeAction, 
  ChromeNotifications,
  ChromeCommands,
  ChromeRuntime 
} from '@/adapters/chrome';

import { telemetry } from '@/core/telemetry';
import { 
  FAFError, 
  FAFErrorCode, 
  FAFErrorSeverity 
} from '@/core/errors';
import { errorNotifications } from '@/ui/error-notifications';

/**
 * Service Worker State Management - Memory-safe state tracking with cleanup
 */
class ServiceWorkerState {
  private readonly activeExtractions = new Map<number, {
    readonly tabId: number;
    readonly startTime: number;
    readonly timeout: NodeJS.Timeout;
  }>();

  private readonly stats = {
    totalExtractions: 0,
    successfulExtractions: 0,
    failedExtractions: 0,
    lastExtraction: null as ExtractionResult | null,
    lastError: null as string | null
  };

  // Memory management constants
  private readonly MAX_ACTIVE_EXTRACTIONS = 10;
  private readonly MAX_EXTRACTION_AGE_MS = 300000; // 5 minutes
  private readonly CLEANUP_INTERVAL_MS = 60000; // 1 minute
  private cleanupTimer: NodeJS.Timeout | null = null;

  constructor() {
    this.startPeriodicCleanup();
  }

  addActiveExtraction(tabId: number, timeout: number): void {
    // Clear any existing extraction for this tab
    this.clearActiveExtraction(tabId);

    // Enforce maximum active extractions limit
    if (this.activeExtractions.size >= this.MAX_ACTIVE_EXTRACTIONS) {
      this.cleanupOldestExtractions(1);
    }

    const timeoutId = setTimeout(() => {
      this.handleExtractionTimeout(tabId);
    }, timeout);

    this.activeExtractions.set(tabId, {
      tabId,
      startTime: Date.now(),
      timeout: timeoutId
    });
  }

  clearActiveExtraction(tabId: number): boolean {
    const extraction = this.activeExtractions.get(tabId);
    if (extraction) {
      clearTimeout(extraction.timeout);
      this.activeExtractions.delete(tabId);
      return true;
    }
    return false;
  }

  isExtractionActive(tabId: number): boolean {
    return this.activeExtractions.has(tabId);
  }

  getActiveExtractionCount(): number {
    return this.activeExtractions.size;
  }

  recordSuccess(result: ExtractionResult): void {
    this.stats.totalExtractions++;
    this.stats.successfulExtractions++;
    this.stats.lastExtraction = result;
    this.stats.lastError = null;

    // Track success in telemetry
    if (result.success && result.faf) {
      telemetry.trackExtraction('complete', {
        platform: result.faf.context.platform,
        score: result.faf.score,
        duration: result.faf.context.metadata.extractionTime,
        fileCount: result.faf.context.structure.totalFiles
      });
    }
  }

  recordFailure(error: string): void {
    this.stats.totalExtractions++;
    this.stats.failedExtractions++;
    this.stats.lastError = error;

    // Track failure in telemetry
    telemetry.trackExtraction('error', {
      error: error
    });
  }

  getStats(): typeof this.stats {
    return { ...this.stats };
  }

  private async handleExtractionTimeout(tabId: number): Promise<void> {
    this.clearActiveExtraction(tabId);
    
    const fafError = new FAFError(
      FAFErrorCode.EXTRACTION_TIMEOUT,
      `Extraction timeout for tab ${tabId}`,
      {
        context: { tabId, timestamp: Date.now() }
      }
    );
    
    this.recordFailure(fafError.userMessage);
    
    // Show standardized error notification
    await errorNotifications.showError(fafError, {
      operationId: `extraction_${tabId}`,
      operationType: 'context_extraction',
      retryOperation: async () => {
        // Retry extraction
        const message: ExtractContextMessage = {
          type: 'EXTRACT_CONTEXT',
          timestamp: Date.now(),
          source: 'service_worker_retry'
        };
        await ChromeTabs.sendMessage(tabId, message);
      }
    });
  }

  /**
   * Start periodic cleanup to prevent memory leaks
   */
  private startPeriodicCleanup(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
    }

    this.cleanupTimer = setInterval(() => {
      this.performCleanup();
    }, this.CLEANUP_INTERVAL_MS);

    // Initial cleanup
    this.performCleanup();
  }

  /**
   * Perform comprehensive memory cleanup
   */
  performCleanup(): void {
    const now = Date.now();
    let cleanedCount = 0;

    // Clean up old extractions
    for (const [tabId, extraction] of this.activeExtractions.entries()) {
      const age = now - extraction.startTime;
      if (age > this.MAX_EXTRACTION_AGE_MS) {
        this.clearActiveExtraction(tabId);
        cleanedCount++;
      }
    }

    // Force cleanup if map is too large
    if (this.activeExtractions.size > this.MAX_ACTIVE_EXTRACTIONS) {
      const excess = this.activeExtractions.size - this.MAX_ACTIVE_EXTRACTIONS;
      this.cleanupOldestExtractions(excess);
      cleanedCount += excess;
    }

    // Cleanup stats memory
    this.cleanupStatsMemory();

    if (cleanedCount > 0) {
      console.log(`🧹 Service Worker cleanup: removed ${cleanedCount} old extractions`);
    }
  }

  /**
   * Clean up oldest extractions to free memory
   */
  private cleanupOldestExtractions(count: number): void {
    const sortedExtractions = Array.from(this.activeExtractions.entries())
      .sort(([, a], [, b]) => a.startTime - b.startTime);

    for (let i = 0; i < Math.min(count, sortedExtractions.length); i++) {
      const extraction = sortedExtractions[i];
      if (extraction) {
        const [tabId] = extraction;
        this.clearActiveExtraction(tabId);
      }
    }
  }

  /**
   * Cleanup stats to prevent memory accumulation
   */
  private cleanupStatsMemory(): void {
    // Clear large objects to prevent memory retention
    if (this.stats.lastExtraction) {
      // Clear heavy objects to prevent memory retention
      this.stats.lastExtraction = null;
      // Store only lightweight reference
      this.stats.lastError = this.stats.lastError?.substring(0, 100) || null;
    }
  }

  /**
   * Stop cleanup timer (for shutdown/cleanup)
   */
  destroy(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }

    // Clean up all active extractions
    for (const [tabId] of this.activeExtractions.entries()) {
      this.clearActiveExtraction(tabId);
    }

    this.activeExtractions.clear();
  }

  /**
   * Get memory usage statistics
   */
  getMemoryStats(): {
    readonly activeExtractions: number;
    readonly totalStats: number;
    readonly memoryPressure: 'low' | 'medium' | 'high';
  } {
    const activeCount = this.activeExtractions.size;
    const totalStats = this.stats.totalExtractions;
    
    let memoryPressure: 'low' | 'medium' | 'high' = 'low';
    if (activeCount > this.MAX_ACTIVE_EXTRACTIONS * 0.8) {
      memoryPressure = 'high';
    } else if (activeCount > this.MAX_ACTIVE_EXTRACTIONS * 0.5) {
      memoryPressure = 'medium';
    }

    return {
      activeExtractions: activeCount,
      totalStats,
      memoryPressure
    };
  }
}

/**
 * @deprecated Use FAFError from @/core/errors instead
 */
class ServiceWorkerError extends Error {
  constructor(
    message: string,
    public readonly code: 'TAB_ERROR' | 'STORAGE_ERROR' | 'MESSAGING_ERROR' | 'EXTRACTION_ERROR' | 'NOTIFICATION_ERROR'
  ) {
    super(message);
    this.name = 'ServiceWorkerError';
  }
}

/**
 * Main Service Worker Manager - Production-grade reliability
 */
class ServiceWorkerManager {
  private readonly state = new ServiceWorkerState();
  private readonly EXTRACTION_TIMEOUT = 5000; // 5s timeout for safety
  private readonly MAX_CONCURRENT_EXTRACTIONS = 3;

  constructor() {
    this.initialize();
  }

  /**
   * Initialize service worker with comprehensive error boundaries
   */
  private initialize(): void {
    try {
      // Track service worker startup
      telemetry.track('user_action', {
        action: 'service_worker_start',
        timestamp: Date.now()
      });

      // Set up all event listeners with error handling
      this.setupMessageHandling();
      this.setupInstallationHandling();
      this.setupCommandHandling();
      this.setupBadgeInitialization();

      console.log('🏎️ FAF Service Worker initialized successfully');
    } catch (error) {
      // Track initialization failure
      telemetry.track('error_boundary', {
        type: 'service_worker_init_failure',
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : 'No stack trace'
      });

      console.error('❌ Service Worker initialization failed:', error);
      throw new FAFError(
        FAFErrorCode.SERVICE_WORKER_INIT_FAILED,
        `Service worker initialization failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        {
          context: { originalError: error }
        }
      );
    }
  }

  /**
   * Set up message handling with comprehensive error recovery
   */
  private setupMessageHandling(): void {
    ChromeRuntime.onMessage((message, sender, sendResponse) => {
      this.handleMessage(message, sender, sendResponse)
        .then(result => {
          if (result !== undefined) {
            sendResponse(result);
          }
        })
        .catch(error => {
          const fafError = error instanceof FAFError ? error : new FAFError(
            FAFErrorCode.SERVICE_WORKER_MESSAGE_FAILED,
            'Service worker message handling failed',
            {
              context: { originalError: error, messageType: message.type }
            }
          );

          console.error('Message handling error:', fafError);

          // Track message handling failure
          telemetry.track('error_boundary', {
            type: 'service_worker_message_error',
            errorCode: fafError.code,
            messageType: message.type,
            severity: fafError.severity
          });

          sendResponse({
            success: false,
            error: fafError.userMessage,
            code: fafError.code
          });
        });
      
      return true; // Keep message channel open for async response
    });
  }

  /**
   * Set up installation and badge initialization
   */
  private setupInstallationHandling(): void {
    ChromeRuntime.onInstalled(() => {
      this.initializeBadge()
        .then(() => {
          console.log('✅ FAF Extension installed and badge initialized');
        })
        .catch(error => {
          console.error('❌ Badge initialization failed:', error);
        });
    });
  }

  /**
   * Set up keyboard command handling
   */
  private setupCommandHandling(): void {
    ChromeCommands.onCommand((command) => {
      if (command === 'extract-context') {
        this.handleKeyboardShortcut()
          .catch(error => {
            console.error('❌ Keyboard shortcut failed:', error);
          });
      }
    });
  }

  /**
   * Initialize badge with default state
   */
  private async initializeBadge(): Promise<void> {
    try {
      await ChromeAction.setBadgeBackgroundColor('#FF6B35');
      await ChromeAction.setBadgeText('FAF');
    } catch (error) {
      throw new ServiceWorkerError(
        `Badge initialization failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'MESSAGING_ERROR'
      );
    }
  }

  /**
   * Set up badge initialization on startup
   */
  private setupBadgeInitialization(): void {
    // Initialize badge immediately
    this.initializeBadge().catch(error => {
      console.error('❌ Initial badge setup failed:', error);
    });
  }

  /**
   * Handle all incoming messages with bulletproof error handling
   */
  private async handleMessage(
    message: Message,
    sender: chrome.runtime.MessageSender,
    _sendResponse: (response?: unknown) => void
  ): Promise<unknown> {
    // Validate message structure
    if (!this.isValidMessage(message)) {
      throw new ServiceWorkerError('Invalid message format', 'MESSAGING_ERROR');
    }

    // Extract tab ID safely
    const tabId = sender.tab?.id;
    if (tabId === undefined) {
      throw new ServiceWorkerError('Message sender has no tab ID', 'TAB_ERROR');
    }

    console.log(`📨 Received message: ${message.type} from tab ${tabId}`);
    
    // Track message received
    telemetry.track('api_call', {
      type: 'message_received',
      messageType: message.type,
      tabId,
      timestamp: Date.now()
    });

    try {
      switch (message.type) {
        case 'EXTRACT_CONTEXT':
          return await this.handleExtractRequest(message as ExtractContextMessage, tabId);

        case 'CONTEXT_EXTRACTED':
          return await this.handleContextExtracted(message as ContextExtractedMessage, tabId);

        case 'ERROR':
          return await this.handleError(message as ErrorMessage, tabId);

        default:
          throw new ServiceWorkerError(`Unknown message type: ${message.type}`, 'MESSAGING_ERROR');
      }
    } catch (error) {
      // Log error and update stats
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      // Track message handling failure
      telemetry.track('error_boundary', {
        type: 'message_handling_error',
        messageType: message.type,
        error: errorMessage,
        tabId
      });
      
      console.error(`❌ Message handling failed for ${message.type}:`, errorMessage);
      this.state.recordFailure(errorMessage);
      throw error;
    }
  }

  /**
   * Handle extraction request with concurrency limits and timeout protection
   */
  private async handleExtractRequest(message: ExtractContextMessage, tabId: number): Promise<{ success: boolean }> {
    // Check concurrency limits
    if (this.state.getActiveExtractionCount() >= this.MAX_CONCURRENT_EXTRACTIONS) {
      throw new ServiceWorkerError(
        `Too many concurrent extractions (max: ${this.MAX_CONCURRENT_EXTRACTIONS})`,
        'EXTRACTION_ERROR'
      );
    }

    // Check if extraction already active for this tab
    if (this.state.isExtractionActive(tabId)) {
      throw new ServiceWorkerError(
        `Extraction already in progress for tab ${tabId}`,
        'EXTRACTION_ERROR'
      );
    }

    try {
      // Start tracking this extraction
      this.state.addActiveExtraction(tabId, this.EXTRACTION_TIMEOUT);

      // Send extraction message to content script
      await ChromeTabs.sendMessage(tabId, message);

      console.log(`🚀 Extraction started for tab ${tabId}`);
      return { success: true };

    } catch (error) {
      // Clean up on failure
      this.state.clearActiveExtraction(tabId);
      
      if (error instanceof FAFError) {
        throw new FAFError(
          FAFErrorCode.SERVICE_WORKER_MESSAGE_FAILED,
          `Tab communication failed: ${error.message}`,
          { context: { tabId, originalError: error } }
        );
      }
      
      throw new ServiceWorkerError(
        `Extraction request failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'EXTRACTION_ERROR'
      );
    }
  }

  /**
   * Handle successful context extraction with comprehensive processing
   */
  private async handleContextExtracted(message: ContextExtractedMessage, tabId: number): Promise<{ success: boolean }> {
    // Clear active extraction
    const wasActive = this.state.clearActiveExtraction(tabId);
    if (!wasActive) {
      console.warn(`⚠️ Received extraction result for inactive tab ${tabId}`);
    }

    const result = message.payload;

    if (!result.success) {
      this.state.recordFailure(result.error);
      throw new ServiceWorkerError(`Extraction failed: ${result.error}`, 'EXTRACTION_ERROR');
    }

    try {
      // Record success
      this.state.recordSuccess(result);

      // Update badge with score
      await this.updateBadgeWithScore(result.faf.score);

      // Store extraction result
      await ChromeStorageAPI.set({
        lastExtraction: result,
        timestamp: Date.now()
      });

      // Show success notification
      await this.showSuccessNotification(result.faf.score, result.faf.context.metadata.extractionTime);

      console.log(`✅ Extraction completed for tab ${tabId} with score ${result.faf.score}%`);
      return { success: true };

    } catch (error) {
      console.error('❌ Post-extraction processing failed:', error);
      throw new ServiceWorkerError(
        `Post-extraction processing failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'STORAGE_ERROR'
      );
    }
  }

  /**
   * Handle error messages from content scripts
   */
  private async handleError(message: ErrorMessage, tabId: number): Promise<{ success: boolean }> {
    // Clear active extraction
    this.state.clearActiveExtraction(tabId);

    // Record failure
    this.state.recordFailure(message.payload.error);

    // Show error notification
    await this.showErrorNotification(message.payload.error);

    console.error(`❌ Content script error in tab ${tabId}:`, message.payload);
    return { success: true };
  }

  /**
   * Handle keyboard shortcut activation
   */
  private async handleKeyboardShortcut(): Promise<void> {
    try {
      const activeTab = await ChromeTabs.getActive();
      
      // Trigger extraction via message
      await this.handleExtractRequest({
        type: 'EXTRACT_CONTEXT',
        timestamp: Date.now(),
        source: 'background'
      } as ExtractContextMessage, activeTab.id);

    } catch (error) {
      console.error('❌ Keyboard shortcut extraction failed:', error);
      await this.showErrorNotification(
        error instanceof Error ? error.message : 'Keyboard shortcut failed'
      );
    }
  }

  /**
   * Update badge with extraction score using proper colors
   */
  private async updateBadgeWithScore(score: Score): Promise<void> {
    try {
      await ChromeAction.updateBadge(score);
    } catch (error) {
      console.error('❌ Badge update failed:', error);
      // Don't throw - badge update is not critical
    }
  }

  /**
   * Show success notification with extraction details
   */
  private async showSuccessNotification(score: Score, extractionTime: number): Promise<void> {
    try {
      const scoreValue = score as number;
      await ChromeNotifications.create(
        'FAF - Context Extracted! ⚡️',
        `Score: ${scoreValue}% | Time: ${Math.round(extractionTime)}ms | Copied to clipboard`,
        'icons/social-logo-128.png'
      );
    } catch (error) {
      console.error('❌ Success notification failed:', error);
      // Don't throw - notifications are not critical
    }
  }

  /**
   * Show error notification
   */
  private async showErrorNotification(error: string): Promise<void> {
    try {
      await ChromeNotifications.create(
        'FAF - Extraction Failed ❌',
        `Error: ${error.substring(0, 100)}${error.length > 100 ? '...' : ''}`,
        'icons/social-logo-128.png'
      );
    } catch (notificationError) {
      console.error('❌ Error notification failed:', notificationError);
      // Don't throw - notifications are not critical
    }
  }

  /**
   * Validate message structure with strict type checking
   */
  private isValidMessage(message: unknown): message is Message {
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

  /**
   * Get service worker health status for debugging
   */
  getHealthStatus(): {
    readonly isHealthy: boolean;
    readonly stats: ReturnType<ServiceWorkerState['getStats']>;
    readonly activeExtractions: number;
    readonly memoryStats: ReturnType<ServiceWorkerState['getMemoryStats']>;
  } {
    const stats = this.state.getStats();
    const activeExtractions = this.state.getActiveExtractionCount();
    const memoryStats = this.state.getMemoryStats();
    
    const isHealthy = (
      stats.lastError === null ||
      (stats.successfulExtractions > 0 && stats.successfulExtractions > stats.failedExtractions)
    ) && memoryStats.memoryPressure !== 'high';

    return {
      isHealthy,
      stats,
      activeExtractions,
      memoryStats
    };
  }

  /**
   * Get comprehensive telemetry health report
   */
  getTelemetryHealthReport(): {
    readonly serviceWorker: ReturnType<ServiceWorkerManager['getHealthStatus']>;
    readonly telemetry: ReturnType<typeof telemetry.generateHealthReport>;
    readonly combined: {
      readonly overall: 'healthy' | 'warning' | 'critical';
      readonly recommendations: readonly string[];
    };
  } {
    const serviceWorkerHealth = this.getHealthStatus();
    const telemetryHealth = telemetry.generateHealthReport();
    
    // Combine health assessments
    let overall: 'healthy' | 'warning' | 'critical' = 'healthy';
    const recommendations: string[] = [];
    
    if (!serviceWorkerHealth.isHealthy) {
      overall = 'critical';
      recommendations.push('Service worker experiencing issues - check error logs');
    }
    
    if (telemetryHealth.status.overall === 'critical') {
      overall = 'critical';
      recommendations.push('Critical telemetry issues detected');
    } else if (telemetryHealth.status.overall === 'warning' && overall === 'healthy') {
      overall = 'warning';
      recommendations.push('Performance degradation detected');
    }
    
    if (serviceWorkerHealth.memoryStats.memoryPressure === 'high') {
      if (overall === 'healthy') overall = 'warning';
      recommendations.push('High memory pressure - consider restart');
    }
    
    if (telemetryHealth.summary.successRate < 0.8 && telemetryHealth.summary.totalExtractions > 5) {
      if (overall === 'healthy') overall = 'warning';
      recommendations.push(`Low success rate: ${Math.round(telemetryHealth.summary.successRate * 100)}%`);
    }
    
    if (recommendations.length === 0) {
      recommendations.push('All systems operating normally');
    }
    
    return {
      serviceWorker: serviceWorkerHealth,
      telemetry: telemetryHealth,
      combined: {
        overall,
        recommendations: recommendations as readonly string[]
      }
    };
  }

  /**
   * Cleanup service worker resources (for shutdown)
   */
  cleanup(): void {
    this.state.destroy();
    console.log('🧹 Service Worker Manager cleaned up successfully');
  }

  /**
   * Force memory cleanup (for emergency situations)
   */
  forceCleanup(): void {
    this.state.performCleanup();
    console.log('🚨 Service Worker forced cleanup completed');
  }
}

// Initialize the service worker manager
let manager: ServiceWorkerManager;

try {
  manager = new ServiceWorkerManager();
  console.log('🏎️ FAF Service Worker Manager started successfully');
} catch (error) {
  console.error('💥 CRITICAL: Service Worker Manager failed to start:', error);
  throw error;
}

// Service Worker lifecycle event handlers for memory management
chrome.runtime.onSuspend?.addListener(() => {
  console.log('🛌 Service Worker suspending - cleaning up resources');
  try {
    manager.cleanup();
  } catch (error) {
    console.error('❌ Error during service worker cleanup:', error);
  }
});

chrome.runtime.onSuspendCanceled?.addListener(() => {
  console.log('🔄 Service Worker suspend canceled - reinitializing');
  try {
    // Reinitialize if needed
    const health = manager.getHealthStatus();
    console.log('Health status after suspend cancel:', health);
  } catch (error) {
    console.error('❌ Error checking health after suspend cancel:', error);
  }
});

// Memory pressure monitoring (if available)
if ('memory' in performance && typeof (performance as any).memory.usedJSHeapSize === 'number') {
  setInterval(() => {
    const memory = (performance as any).memory;
    const used = memory.usedJSHeapSize / 1048576; // MB
    const total = memory.totalJSHeapSize / 1048576; // MB
    
    if (used > 50) { // 50MB threshold
      console.warn(`⚠️ High memory usage: ${used.toFixed(1)}MB / ${total.toFixed(1)}MB`);
      const health = manager.getHealthStatus();
      if (health.memoryStats.memoryPressure === 'high') {
        console.log('🚨 Forcing cleanup due to memory pressure');
        manager.forceCleanup();
      }
    }
  }, 30000); // Check every 30 seconds
}

// Periodic health monitoring
setInterval(() => {
  try {
    const health = manager.getHealthStatus();
    if (!health.isHealthy) {
      console.warn('⚠️ Service Worker health check failed:', health);
      
      if (health.memoryStats.memoryPressure === 'high') {
        manager.forceCleanup();
      }
    }
  } catch (error) {
    console.error('❌ Health check failed:', error);
  }
}, 60000); // Check every minute

// Export for testing and debugging
if (typeof globalThis !== 'undefined') {
  (globalThis as any).__FAF_SERVICE_WORKER_MANAGER__ = manager;
  (globalThis as any).__FAF_MEMORY_DEBUG__ = {
    getHealth: () => manager.getHealthStatus(),
    forceCleanup: () => manager.forceCleanup(),
    getMemoryUsage: () => {
      if ('memory' in performance) {
        const memory = (performance as any).memory;
        return {
          used: memory.usedJSHeapSize / 1048576,
          total: memory.totalJSHeapSize / 1048576,
          limit: memory.jsHeapSizeLimit / 1048576
        };
      }
      return null;
    }
  };
}