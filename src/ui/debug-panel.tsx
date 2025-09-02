/**
 * FAF Debug Panel - Development telemetry and health monitoring UI
 */

import React, { useState, useEffect, useCallback } from 'react';
import { telemetry, type TelemetryEvent, type HealthStatus, type PerformanceMetric } from '@/core/telemetry';

interface DebugPanelProps {
  readonly isVisible?: boolean;
  readonly onClose?: () => void;
}

export const DebugPanel: React.FC<DebugPanelProps> = ({ 
  isVisible = false, 
  onClose 
}) => {
  const [healthReport, setHealthReport] = useState<ReturnType<typeof telemetry.generateHealthReport> | null>(null);
  const [recentEvents, setRecentEvents] = useState<readonly TelemetryEvent[]>([]);
  const [selectedTab, setSelectedTab] = useState<'health' | 'events' | 'metrics'>('health');

  // Refresh data periodically
  const refreshData = useCallback(() => {
    try {
      const report = telemetry.generateHealthReport();
      const events = telemetry.getEvents(50);
      
      setHealthReport(report);
      setRecentEvents(events);
    } catch (error) {
      console.error('Failed to refresh debug data:', error);
    }
  }, []);

  useEffect(() => {
    if (isVisible) {
      refreshData();
      const interval = setInterval(refreshData, 2000); // Refresh every 2s
      return () => clearInterval(interval);
    }
    return;
  }, [isVisible, refreshData]);

  if (!isVisible) return null;

  return (
    <div className="faf-debug-panel">
      <div className="faf-debug-header">
        <h2>🔧 FAF Debug Panel</h2>
        <div className="faf-debug-tabs">
          <button 
            className={selectedTab === 'health' ? 'active' : ''}
            onClick={() => setSelectedTab('health')}
          >
            Health
          </button>
          <button 
            className={selectedTab === 'metrics' ? 'active' : ''}
            onClick={() => setSelectedTab('metrics')}
          >
            Metrics
          </button>
          <button 
            className={selectedTab === 'events' ? 'active' : ''}
            onClick={() => setSelectedTab('events')}
          >
            Events
          </button>
        </div>
        <button className="faf-debug-close" onClick={onClose}>×</button>
      </div>

      <div className="faf-debug-content">
        {selectedTab === 'health' && (
          <HealthTab healthReport={healthReport} onRefresh={refreshData} />
        )}
        
        {selectedTab === 'metrics' && (
          <MetricsTab metrics={healthReport?.metrics || []} onRefresh={refreshData} />
        )}
        
        {selectedTab === 'events' && (
          <EventsTab events={recentEvents} onRefresh={refreshData} />
        )}
      </div>
    </div>
  );
};

interface HealthTabProps {
  readonly healthReport: ReturnType<typeof telemetry.generateHealthReport> | null;
  readonly onRefresh: () => void;
}

const HealthTab: React.FC<HealthTabProps> = ({ healthReport, onRefresh }) => {
  if (!healthReport) {
    return <div className="faf-debug-loading">Loading health data...</div>;
  }

  const { status, summary } = healthReport;
  const statusColor = status.overall === 'healthy' ? '#4CAF50' : 
                     status.overall === 'warning' ? '#FF9800' : '#F44336';

  return (
    <div className="faf-health-tab">
      <div className="faf-health-overview">
        <div className="faf-health-status" style={{ color: statusColor }}>
          <span className="faf-health-indicator">●</span>
          <span>{status.overall.toUpperCase()}</span>
        </div>
        <button onClick={onRefresh} className="faf-refresh-btn">
          ⟳ Refresh
        </button>
      </div>

      <div className="faf-health-summary">
        <div className="faf-summary-item">
          <label>Total Extractions:</label>
          <span>{summary.totalExtractions}</span>
        </div>
        <div className="faf-summary-item">
          <label>Success Rate:</label>
          <span>{Math.round(summary.successRate * 100)}%</span>
        </div>
        <div className="faf-summary-item">
          <label>Avg Duration:</label>
          <span>{Math.round(summary.avgDuration)}ms</span>
        </div>
        <div className="faf-summary-item">
          <label>Memory Usage:</label>
          <span>{Math.round(summary.memoryUsage / 1024 / 1024)}MB</span>
        </div>
      </div>

      <div className="faf-health-checks">
        <h3>Health Checks</h3>
        {status.checks.map((check, index) => (
          <HealthCheckItem key={index} check={check} />
        ))}
      </div>

      <div className="faf-health-uptime">
        <label>Uptime:</label>
        <span>{Math.round(status.uptime / 1000)}s</span>
      </div>
    </div>
  );
};

interface HealthCheckItemProps {
  readonly check: HealthStatus['checks'][0];
}

const HealthCheckItem: React.FC<HealthCheckItemProps> = ({ check }) => {
  const statusColor = check.status === 'pass' ? '#4CAF50' : 
                     check.status === 'warn' ? '#FF9800' : '#F44336';
  
  return (
    <div className="faf-health-check">
      <div className="faf-check-status" style={{ color: statusColor }}>
        <span className="faf-check-indicator">●</span>
        <span className="faf-check-name">{check.name}</span>
      </div>
      <div className="faf-check-message">{check.message}</div>
      {check.value !== undefined && check.threshold !== undefined && (
        <div className="faf-check-values">
          {check.value} / {check.threshold}
        </div>
      )}
    </div>
  );
};

interface MetricsTabProps {
  readonly metrics: readonly PerformanceMetric[];
  readonly onRefresh: () => void;
}

const MetricsTab: React.FC<MetricsTabProps> = ({ metrics, onRefresh }) => {
  return (
    <div className="faf-metrics-tab">
      <div className="faf-metrics-header">
        <h3>Performance Metrics</h3>
        <button onClick={onRefresh} className="faf-refresh-btn">
          ⟳ Refresh
        </button>
      </div>
      
      <div className="faf-metrics-list">
        {metrics.length === 0 ? (
          <div className="faf-no-data">No metrics available</div>
        ) : (
          metrics.map((metric, index) => (
            <MetricItem key={index} metric={metric} />
          ))
        )}
      </div>
    </div>
  );
};

interface MetricItemProps {
  readonly metric: PerformanceMetric;
}

const MetricItem: React.FC<MetricItemProps> = ({ metric }) => {
  const healthColor = metric.isHealthy ? '#4CAF50' : '#F44336';
  
  return (
    <div className="faf-metric-item">
      <div className="faf-metric-header">
        <span className="faf-metric-name">{metric.name}</span>
        <span className="faf-metric-health" style={{ color: healthColor }}>
          {metric.isHealthy ? '✓' : '⚠'}
        </span>
      </div>
      <div className="faf-metric-value">
        {metric.value}{metric.unit}
        {metric.threshold && (
          <span className="faf-metric-threshold"> / {metric.threshold}{metric.unit}</span>
        )}
      </div>
    </div>
  );
};

interface EventsTabProps {
  readonly events: readonly TelemetryEvent[];
  readonly onRefresh: () => void;
}

const EventsTab: React.FC<EventsTabProps> = ({ events, onRefresh }) => {
  return (
    <div className="faf-events-tab">
      <div className="faf-events-header">
        <h3>Recent Events</h3>
        <button onClick={onRefresh} className="faf-refresh-btn">
          ⟳ Refresh
        </button>
      </div>
      
      <div className="faf-events-list">
        {events.length === 0 ? (
          <div className="faf-no-data">No events recorded</div>
        ) : (
          events.map((event, index) => (
            <EventItem key={index} event={event} />
          ))
        )}
      </div>
    </div>
  );
};

interface EventItemProps {
  readonly event: TelemetryEvent;
}

const EventItem: React.FC<EventItemProps> = ({ event }) => {
  const typeColor = event.type.includes('error') ? '#F44336' : 
                   event.type.includes('complete') ? '#4CAF50' : '#2196F3';
  
  const timestamp = new Date(event.timestamp).toLocaleTimeString();
  
  return (
    <div className="faf-event-item">
      <div className="faf-event-header">
        <span className="faf-event-type" style={{ color: typeColor }}>
          {event.type}
        </span>
        <span className="faf-event-time">{timestamp}</span>
      </div>
      <div className="faf-event-data">
        {Object.entries(event.data)
          .filter(([key]) => !['timestamp', 'session'].includes(key))
          .map(([key, value]) => (
            <div key={key} className="faf-event-data-item">
              <span className="faf-event-key">{key}:</span>
              <span className="faf-event-value">
                {typeof value === 'object' ? JSON.stringify(value) : String(value)}
              </span>
            </div>
          ))
        }
      </div>
    </div>
  );
};

// CSS-in-JS styles for the debug panel (would normally be in a separate .css file)
export const debugPanelStyles = `
.faf-debug-panel {
  position: fixed;
  top: 10px;
  right: 10px;
  width: 400px;
  max-height: 600px;
  background: #1a1a1a;
  color: #ffffff;
  border: 1px solid #333;
  border-radius: 8px;
  z-index: 10000;
  font-family: 'Monaco', 'Menlo', monospace;
  font-size: 12px;
  overflow: hidden;
}

.faf-debug-header {
  display: flex;
  align-items: center;
  padding: 8px;
  background: #2d2d2d;
  border-bottom: 1px solid #333;
}

.faf-debug-header h2 {
  margin: 0;
  font-size: 14px;
  flex: 1;
}

.faf-debug-tabs {
  display: flex;
  gap: 4px;
}

.faf-debug-tabs button {
  padding: 4px 8px;
  border: 1px solid #555;
  background: #333;
  color: #fff;
  border-radius: 4px;
  cursor: pointer;
  font-size: 11px;
}

.faf-debug-tabs button.active {
  background: #FF6B35;
  border-color: #FF6B35;
}

.faf-debug-close {
  margin-left: 8px;
  padding: 4px 8px;
  border: none;
  background: #f44336;
  color: white;
  border-radius: 4px;
  cursor: pointer;
}

.faf-debug-content {
  max-height: 500px;
  overflow-y: auto;
  padding: 8px;
}

.faf-health-overview {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.faf-health-status {
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: bold;
}

.faf-refresh-btn {
  padding: 4px 8px;
  border: 1px solid #555;
  background: #333;
  color: #fff;
  border-radius: 4px;
  cursor: pointer;
  font-size: 11px;
}

.faf-health-summary {
  background: #2a2a2a;
  padding: 8px;
  border-radius: 4px;
  margin-bottom: 12px;
}

.faf-summary-item {
  display: flex;
  justify-content: space-between;
  margin-bottom: 4px;
}

.faf-health-checks h3 {
  margin: 0 0 8px 0;
  font-size: 13px;
}

.faf-health-check {
  background: #2a2a2a;
  padding: 6px;
  border-radius: 4px;
  margin-bottom: 4px;
}

.faf-check-status {
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: bold;
}

.faf-check-message {
  font-size: 11px;
  opacity: 0.8;
  margin-top: 2px;
}

.faf-metric-item {
  background: #2a2a2a;
  padding: 6px;
  border-radius: 4px;
  margin-bottom: 4px;
}

.faf-metric-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.faf-event-item {
  background: #2a2a2a;
  padding: 6px;
  border-radius: 4px;
  margin-bottom: 4px;
}

.faf-event-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 4px;
}

.faf-event-data-item {
  display: flex;
  gap: 8px;
  font-size: 10px;
  opacity: 0.8;
}

.faf-event-key {
  color: #80CBC4;
}

.faf-no-data {
  text-align: center;
  opacity: 0.6;
  padding: 20px;
}

.faf-debug-loading {
  text-align: center;
  padding: 20px;
}
`;