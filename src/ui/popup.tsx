/**
 * FAF React Popup Component - Production UI with strict types
 */

import React, { useState, useEffect, useCallback } from 'react';
import type { 
  ExtractionResult, 
  Platform,
  FAFFile,
  Score
} from '@/core/types';
import { getBadgeColors, getScoreValue } from '@/core/types';
import { ChromeStorageAPI, ChromeTabs } from '@/adapters/chrome';
import { telemetry } from '@/core/telemetry';

interface PopupState {
  readonly lastExtraction: ExtractionResult | null;
  readonly isExtracting: boolean;
  readonly error: string | null;
}

export const FAFPopup: React.FC = () => {
  const [state, setState] = useState<PopupState>({
    lastExtraction: null,
    isExtracting: false,
    error: null
  });

  // Load stored extraction on mount
  useEffect(() => {
    const loadStoredExtraction = async (): Promise<void> => {
      try {
        // Track popup opened
        telemetry.track('user_action', {
          action: 'popup_opened',
          timestamp: Date.now()
        });

        const { lastExtraction } = await ChromeStorageAPI.get(['lastExtraction']);
        if (lastExtraction) {
          setState(prev => ({
            ...prev,
            lastExtraction
          }));
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Failed to load stored data';
        
        // Track popup error
        telemetry.track('error_boundary', {
          type: 'popup_load_error',
          error: errorMessage
        });

        setState(prev => ({
          ...prev,
          error: errorMessage
        }));
      }
    };

    loadStoredExtraction();
  }, []);

  // Handle extraction
  const handleExtract = useCallback(async (): Promise<void> => {
    setState(prev => ({ ...prev, isExtracting: true, error: null }));

    // Track extraction initiated from popup
    telemetry.track('user_action', {
      action: 'extraction_button_clicked',
      source: 'popup',
      timestamp: Date.now()
    });

    try {
      const activeTab = await ChromeTabs.getActive();
      
      await ChromeTabs.sendMessage(activeTab.id, {
        type: 'EXTRACT_CONTEXT',
        timestamp: Date.now(),
        source: 'popup'
      });

      // Track successful message send
      telemetry.track('api_call', {
        type: 'message_sent',
        messageType: 'EXTRACT_CONTEXT',
        tabId: activeTab.id
      });

      // Close popup after triggering extraction
      window.close();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Extraction failed';
      
      // Track extraction failure
      telemetry.track('error_boundary', {
        type: 'popup_extraction_error',
        error: errorMessage,
        source: 'popup'
      });

      setState(prev => ({
        ...prev,
        isExtracting: false,
        error: errorMessage
      }));
    }
  }, []);

  return (
    <div className="faf-popup">
      <PopupHeader />
      <PopupContent 
        extraction={state.lastExtraction}
        isExtracting={state.isExtracting}
        error={state.error}
      />
      <PopupActions 
        onExtract={handleExtract}
        isExtracting={state.isExtracting}
      />
      <PopupFooter />
    </div>
  );
};

const PopupHeader: React.FC = () => (
  <header className="faf-header">
    <div className="faf-logo">⚡️</div>
    <h1 className="faf-title">FAF</h1>
    <span className="faf-tagline">Fast AF Context</span>
  </header>
);

interface PopupContentProps {
  readonly extraction: ExtractionResult | null;
  readonly isExtracting: boolean;
  readonly error: string | null;
}

const PopupContent: React.FC<PopupContentProps> = ({ 
  extraction, 
  isExtracting, 
  error 
}) => {
  if (error) {
    return (
      <main className="faf-content">
        <div className="faf-error">
          <span className="faf-error-icon">⚠️</span>
          <span className="faf-error-text">{error}</span>
        </div>
      </main>
    );
  }

  if (isExtracting) {
    return (
      <main className="faf-content">
        <div className="faf-loading">
          <span className="faf-loading-icon">🏎️</span>
          <span className="faf-loading-text">Extracting context...</span>
        </div>
      </main>
    );
  }

  if (extraction?.success) {
    return (
      <main className="faf-content">
        <ExtractionStats faf={extraction.faf} />
      </main>
    );
  }

  return (
    <main className="faf-content">
      <p className="faf-empty">No extraction yet</p>
    </main>
  );
};

interface ExtractionStatsProps {
  readonly faf: FAFFile;
}

const ExtractionStats: React.FC<ExtractionStatsProps> = ({ faf }) => {
  const score = getScoreValue(faf.score);
  const extractionTime = faf.context.metadata.extractionTime;
  const platform = faf.context.platform;

  return (
    <div className="faf-stats">
      <StatItem 
        label="Score" 
        value={`${score}%`}
        className="faf-stat-score"
        style={{ color: getScoreColor(faf.score) }}
      />
      <StatItem 
        label="Platform" 
        value={formatPlatform(platform)}
        className="faf-stat-platform"
      />
      <StatItem 
        label="Speed" 
        value={`${Math.round(extractionTime)}ms`}
        className="faf-stat-speed"
      />
    </div>
  );
};

interface StatItemProps {
  readonly label: string;
  readonly value: string;
  readonly className: string;
  readonly style?: React.CSSProperties;
}

const StatItem: React.FC<StatItemProps> = ({ label, value, className, style }) => (
  <div className={`faf-stat ${className}`}>
    <span className="faf-stat-label">{label}</span>
    <span className="faf-stat-value" style={style}>{value}</span>
  </div>
);

interface PopupActionsProps {
  readonly onExtract: () => Promise<void>;
  readonly isExtracting: boolean;
}

const PopupActions: React.FC<PopupActionsProps> = ({ onExtract, isExtracting }) => (
  <div className="faf-actions">
    <button 
      className="faf-extract-btn"
      onClick={onExtract}
      disabled={isExtracting}
      type="button"
    >
      <span className="faf-btn-icon">🏎️</span>
      <span className="faf-btn-text">Extract Context</span>
      <span className="faf-btn-icon">⚡️</span>
    </button>
  </div>
);

const PopupFooter: React.FC = () => (
  <footer className="faf-footer">
    <span className="faf-shortcut">⌘+Shift+F</span>
    <span className="faf-version">v1.0.0</span>
  </footer>
);

// Helper functions
function getScoreColor(score: Score): string {
  const colors = getBadgeColors(score);
  return colors.bg;
}

function formatPlatform(platform: Platform): string {
  const platformNames: Record<Platform, string> = {
    'github': 'GitHub',
    'gitlab': 'GitLab',
    'monaco': 'Monaco Editor',
    'codemirror': 'CodeMirror',
    'vscode-web': 'VS Code Web',
    'stackblitz': 'StackBlitz',
    'codesandbox': 'CodeSandbox',
    'codepen': 'CodePen',
    'localhost': 'Localhost',
    'has-code': 'HasCode',
    'unknown': 'Unknown'
  };
  
  return platformNames[platform];
}