/**
 * Enhanced Telemetry & Monitoring for Production
 */

interface TelemetryConfig {
  environment: 'development' | 'staging' | 'production';
  enableErrorReporting: boolean;
  enablePerformanceTracking: boolean;
  enableUserAnalytics: boolean;
  sampleRate: number;
  endpoint?: string;
}

interface PerformanceMetric {
  name: string;
  value: number;
  unit: 'ms' | 'bytes' | 'count';
  timestamp: number;
  metadata?: Record<string, any>;
}

interface ErrorReport {
  error: Error;
  context: {
    url?: string;
    userAgent: string;
    timestamp: number;
    userId?: string;
    sessionId: string;
    extensionVersion: string;
    action?: string;
  };
  stackTrace: string;
  breadcrumbs: string[];
}

interface UserEvent {
  event: string;
  properties: Record<string, any>;
  timestamp: number;
  sessionId: string;
  userId?: string;
}

class ProductionTelemetry {
  private config: TelemetryConfig;
  private sessionId: string;
  private breadcrumbs: string[] = [];
  private performanceBuffer: PerformanceMetric[] = [];
  private userId?: string;

  constructor(config: TelemetryConfig) {
    this.config = config;
    this.sessionId = this.generateSessionId();
    this.initializeErrorHandling();
    this.initializePerformanceTracking();
    this.startPerformanceReporting();
  }

  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private initializeErrorHandling(): void {
    if (!this.config.enableErrorReporting) return;

    // Only set up window/document error handlers if available (not in service worker)
    if (typeof window !== 'undefined') {
      // Global error handler
      window.addEventListener('error', (event) => {
        this.reportError(new Error(event.message), {
          action: 'global_error',
          url: event.filename,
          line: event.lineno,
          column: event.colno
        });
      });

      // Unhandled promise rejection handler
      window.addEventListener('unhandledrejection', (event) => {
        this.reportError(
          new Error(`Unhandled Promise Rejection: ${event.reason}`),
          { action: 'unhandled_promise_rejection' }
        );
      });
    }
  }

  private initializePerformanceTracking(): void {
    if (!this.config.enablePerformanceTracking) return;

    // Track page load performance (only available in window context)
    if (typeof window !== 'undefined' && typeof performance !== 'undefined' && performance.timing) {
      window.addEventListener('load', () => {
        setTimeout(() => {
          this.trackPerformanceMetrics();
        }, 1000);
      });
    }

    // Track Chrome extension specific metrics
    this.trackExtensionMetrics();
  }

  private trackExtensionMetrics(): void {
    // Track service worker startup time
    if (chrome?.runtime) {
      const startTime = performance.now();
      // chrome.runtime.connect({ name: 'telemetry' });
      const connectionTime = performance.now() - startTime;
      
      this.recordMetric({
        name: 'service_worker_connection_time',
        value: connectionTime,
        unit: 'ms',
        timestamp: Date.now()
      });
    }

    // Track content script injection time (only available in document context)
    if (typeof document !== 'undefined' && document.readyState === 'loading') {
      const injectionStart = performance.now();
      document.addEventListener('DOMContentLoaded', () => {
        const injectionTime = performance.now() - injectionStart;
        this.recordMetric({
          name: 'content_script_injection_time',
          value: injectionTime,
          unit: 'ms',
          timestamp: Date.now()
        });
      });
    }
  }

  private trackPerformanceMetrics(): void {
    const timing = performance.timing;
    const navigation = performance.navigation;

    // Core Web Vitals
    const metrics = [
      {
        name: 'dom_content_loaded',
        value: timing.domContentLoadedEventEnd - timing.navigationStart,
        unit: 'ms' as const
      },
      {
        name: 'page_load_complete',
        value: timing.loadEventEnd - timing.navigationStart,
        unit: 'ms' as const
      },
      {
        name: 'dns_lookup_time',
        value: timing.domainLookupEnd - timing.domainLookupStart,
        unit: 'ms' as const
      },
      {
        name: 'tcp_connection_time',
        value: timing.connectEnd - timing.connectStart,
        unit: 'ms' as const
      }
    ];

    metrics.forEach(metric => {
      if (metric.value > 0) {
        this.recordMetric({
          ...metric,
          timestamp: Date.now(),
          metadata: {
            navigationType: navigation.type,
            redirectCount: navigation.redirectCount
          }
        });
      }
    });

    // Memory usage (if available)
    if ((performance as any).memory) {
      const memory = (performance as any).memory;
      this.recordMetric({
        name: 'memory_used',
        value: memory.usedJSHeapSize,
        unit: 'bytes',
        timestamp: Date.now()
      });
      
      this.recordMetric({
        name: 'memory_limit',
        value: memory.jsHeapSizeLimit,
        unit: 'bytes',
        timestamp: Date.now()
      });
    }
  }

  private startPerformanceReporting(): void {
    // Send performance metrics every 30 seconds
    setInterval(() => {
      if (this.performanceBuffer.length > 0) {
        this.flushPerformanceMetrics();
      }
    }, 30000);
  }

  async recordMetric(metric: PerformanceMetric): Promise<void> {
    if (!this.config.enablePerformanceTracking) return;

    // Sample metrics based on sample rate
    if (Math.random() > this.config.sampleRate) return;

    this.performanceBuffer.push(metric);

    // Store locally for offline capability
    try {
      const stored = await chrome.storage.local.get('telemetry_metrics');
      const metrics = stored.telemetry_metrics || [];
      metrics.push(metric);

      // Keep only last 100 metrics
      if (metrics.length > 100) {
        metrics.shift();
      }

      await chrome.storage.local.set({ telemetry_metrics: metrics });
    } catch (error) {
      console.warn('Failed to store telemetry metric:', error);
    }
  }

  async reportError(error: Error, context: any = {}): Promise<void> {
    if (!this.config.enableErrorReporting) return;

    const report: ErrorReport = {
      error: {
        name: error.name,
        message: error.message,
        stack: error.stack || ''
      } as Error,
      context: {
        userAgent: navigator.userAgent,
        timestamp: Date.now(),
        sessionId: this.sessionId,
        userId: this.userId,
        extensionVersion: this.getExtensionVersion(),
        ...context
      },
      stackTrace: error.stack || '',
      breadcrumbs: [...this.breadcrumbs]
    };

    // Store locally first
    try {
      const stored = await chrome.storage.local.get('telemetry_errors');
      const errors = stored.telemetry_errors || [];
      errors.push(report);

      // Keep only last 50 errors
      if (errors.length > 50) {
        errors.shift();
      }

      await chrome.storage.local.set({ telemetry_errors: errors });
    } catch (storageError) {
      console.warn('Failed to store error report:', storageError);
    }

    // Send to remote endpoint
    this.sendErrorReport(report);
  }

  async trackUserEvent(event: string, properties: Record<string, any> = {}): Promise<void> {
    if (!this.config.enableUserAnalytics) return;

    const userEvent: UserEvent = {
      event,
      properties: {
        ...properties,
        extensionVersion: this.getExtensionVersion(),
        environment: this.config.environment
      },
      timestamp: Date.now(),
      sessionId: this.sessionId,
      userId: this.userId
    };

    // Store locally
    try {
      const stored = await chrome.storage.local.get('telemetry_events');
      const events = stored.telemetry_events || [];
      events.push(userEvent);

      // Keep only last 200 events
      if (events.length > 200) {
        events.shift();
      }

      await chrome.storage.local.set({ telemetry_events: events });
    } catch (error) {
      console.warn('Failed to store user event:', error);
    }

    // Send to analytics
    this.sendUserEvent(userEvent);
  }

  async trackExtraction(phase: 'start' | 'complete' | 'error' | 'fallback', properties: Record<string, any> = {}): Promise<void> {
    return this.trackUserEvent(`extraction_${phase}`, properties);
  }

  async track(event: string, properties: Record<string, any> = {}): Promise<void> {
    return this.trackUserEvent(event, properties);
  }

  addBreadcrumb(message: string): void {
    const breadcrumb = `${new Date().toISOString()}: ${message}`;
    this.breadcrumbs.push(breadcrumb);

    // Keep only last 20 breadcrumbs
    if (this.breadcrumbs.length > 20) {
      this.breadcrumbs.shift();
    }
  }

  setUserId(userId: string): void {
    this.userId = userId;
  }

  private async flushPerformanceMetrics(): Promise<void> {
    if (this.performanceBuffer.length === 0) return;

    const metrics = [...this.performanceBuffer];
    this.performanceBuffer = [];

    try {
      await this.sendBatch('metrics', metrics);
    } catch (error) {
      console.warn('Failed to send performance metrics:', error);
      // Re-add to buffer for retry
      this.performanceBuffer.unshift(...metrics);
    }
  }

  private async sendErrorReport(report: ErrorReport): Promise<void> {
    try {
      await this.sendBatch('errors', [report]);
    } catch (error) {
      console.warn('Failed to send error report:', error);
    }
  }

  private async sendUserEvent(event: UserEvent): Promise<void> {
    try {
      await this.sendBatch('events', [event]);
    } catch (error) {
      console.warn('Failed to send user event:', error);
    }
  }

  private async sendBatch(type: string, data: any[]): Promise<void> {
    if (!this.config.endpoint) return;

    const payload = {
      type,
      data,
      timestamp: Date.now(),
      sessionId: this.sessionId,
      userId: this.userId,
      environment: this.config.environment
    };

    const response = await fetch(`${this.config.endpoint}/${type}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
  }

  private getExtensionVersion(): string {
    try {
      return chrome.runtime.getManifest().version;
    } catch {
      return 'unknown';
    }
  }

  // Performance timing utilities
  startTimer(name: string): () => void {
    const startTime = performance.now();
    
    return () => {
      const duration = performance.now() - startTime;
      this.recordMetric({
        name,
        value: duration,
        unit: 'ms',
        timestamp: Date.now()
      });
    };
  }

  // Memory usage tracking
  trackMemoryUsage(context: string): void {
    if ((performance as any).memory) {
      const memory = (performance as any).memory;
      this.recordMetric({
        name: 'memory_usage_snapshot',
        value: memory.usedJSHeapSize,
        unit: 'bytes',
        timestamp: Date.now(),
        metadata: { context }
      });
    }
  }

  // Network request tracking
  trackNetworkRequest(url: string, method: string, duration: number, status: number): void {
    this.recordMetric({
      name: 'network_request',
      value: duration,
      unit: 'ms',
      timestamp: Date.now(),
      metadata: {
        url: url.replace(/[?#].*/, ''), // Remove query params for privacy
        method,
        status,
        success: status >= 200 && status < 400
      }
    });
  }
}

// Initialize telemetry based on environment
const createTelemetry = (): ProductionTelemetry => {
  // Use fallback values since process.env doesn't exist in Chrome extension service workers
  const nodeEnv = (typeof process !== 'undefined' && process.env?.NODE_ENV) || 'production';
  const telemetryEndpoint = (typeof process !== 'undefined' && process.env?.TELEMETRY_ENDPOINT) || undefined;
  
  const isDevelopment = nodeEnv === 'development';
  const isProduction = nodeEnv === 'production';

  const config: TelemetryConfig = {
    environment: isDevelopment ? 'development' : isProduction ? 'production' : 'staging',
    enableErrorReporting: isProduction,
    enablePerformanceTracking: true,
    enableUserAnalytics: isProduction,
    sampleRate: isDevelopment ? 1.0 : 0.1, // 100% in dev, 10% in prod
    endpoint: telemetryEndpoint
  };

  return new ProductionTelemetry(config);
};

// Performance tracking utility function
export const trackPerformance = async <T>(name: string, operation: () => Promise<T>): Promise<T> => {
  const timer = telemetry.startTimer(name);
  try {
    const result = await operation();
    timer(); // Record timing
    return result;
  } catch (error) {
    timer(); // Record timing even on error
    throw error;
  }
};

export const telemetry = createTelemetry();
export { ProductionTelemetry, type TelemetryConfig, type PerformanceMetric, type ErrorReport, type UserEvent };