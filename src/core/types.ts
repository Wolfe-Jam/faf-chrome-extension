/**
 * FAF Core Types - Strict TypeScript Definitions
 * Zero any types, complete type coverage
 */

import type { FAFErrorCode } from '@/core/errors';

export const PLATFORMS = [
  'github',
  'gitlab',
  'monaco',
  'codemirror',
  'vscode-web',
  'stackblitz',
  'codesandbox',
  'codepen',
  'localhost',
  'has-code',
  'unknown',
] as const;
export type Platform = (typeof PLATFORMS)[number];

export const BRAND_COLORS = {
  orange: '#FF6B35',
  cream: '#FFF8F0',
  cyan: '#5CE1E6',
  black: '#0A0A0A',
} as const;

export interface PlatformDetection {
  readonly platform: Platform;
  readonly features: readonly string[];
}

export interface FileInfo {
  readonly path: string;
  readonly language: string;
  readonly content: string;
  readonly lines: number;
  readonly size: number;
}

export interface ProjectStructure {
  readonly files: readonly FileInfo[];
  readonly directories: readonly string[];
  readonly entryPoints: readonly string[];
  readonly totalFiles: number;
  readonly totalLines: number;
}

export interface DependencyInfo {
  readonly name: string;
  readonly version: string;
  readonly isDev: boolean;
}

export interface RuntimeInfo {
  readonly language: string;
  readonly version: string;
  readonly packageManager: 'npm' | 'yarn' | 'pnpm' | 'bun' | 'unknown';
}

export interface Dependencies {
  readonly runtime: RuntimeInfo;
  readonly packages: readonly DependencyInfo[];
  readonly lockFile: string | null;
}

export interface EnvironmentVariable {
  readonly key: string;
  readonly isRequired: boolean;
  readonly hasDefaultValue: boolean;
}

export interface Environment {
  readonly variables: readonly EnvironmentVariable[];
  readonly configFiles: readonly string[];
}

export interface ExtractionMetadata {
  readonly extractionTime: number;
  readonly version: string;
  readonly timestamp: string;
  readonly url: string;
  readonly userAgent: string;
  // GitHub-specific rich metadata
  readonly description?: string;
  readonly topics?: readonly string[];
  readonly stars?: string;
  readonly license?: string;
  readonly languages?: readonly string[];
  readonly lastUpdated?: string;
  readonly defaultBranch?: string;
  // Generic metadata for other platforms
  readonly [key: string]: any;
}

export interface CodeContext {
  readonly platform: Platform;
  readonly structure: ProjectStructure;
  readonly dependencies: Dependencies;
  readonly environment: Environment;
  readonly metadata: ExtractionMetadata;
}

export interface FAFFile {
  readonly version: string;
  readonly generated: string;
  readonly context: CodeContext;
  readonly summary: string;
  readonly ai_instructions: string;
  readonly checksum: string;
  readonly compressed: boolean;
  readonly size: number;
}

export type ExtractionResult =
  | {
      readonly success: true;
      readonly faf: FAFFile;
    }
  | {
      readonly success: false;
      readonly error: string;
      readonly code: FAFErrorCode;
    };

export const MESSAGE_TYPES = [
  'EXTRACT_CONTEXT',
  'CONTEXT_EXTRACTED',
  'COPY_TO_CLIPBOARD',
  'UPDATE_BADGE',
  'ERROR',
  'PING',
  'PONG',
] as const;

export type MessageType = (typeof MESSAGE_TYPES)[number];

export interface BaseMessage {
  readonly type: MessageType;
  readonly timestamp: number;
  readonly source: 'popup' | 'content' | 'background' | 'service-worker';
}

export interface ExtractContextMessage extends BaseMessage {
  readonly type: 'EXTRACT_CONTEXT';
}

export interface ContextExtractedMessage extends BaseMessage {
  readonly type: 'CONTEXT_EXTRACTED';
  readonly payload: ExtractionResult;
}

export interface CopyToClipboardMessage extends BaseMessage {
  readonly type: 'COPY_TO_CLIPBOARD';
  readonly payload: { readonly text: string };
}

// UpdateBadgeMessage removed - no longer using badge scoring

export interface ErrorMessage extends BaseMessage {
  readonly type: 'ERROR';
  readonly payload: {
    readonly error: string;
    readonly code: string;
    readonly stack?: string;
  };
}

export interface PingMessage extends BaseMessage {
  readonly type: 'PING';
}

export interface PongMessage extends BaseMessage {
  readonly type: 'PONG';
}

export type Message =
  | ExtractContextMessage
  | ContextExtractedMessage
  | CopyToClipboardMessage
  | ErrorMessage
  | PingMessage
  | PongMessage;

export function isValidPlatform(value: string): value is Platform {
  return PLATFORMS.includes(value as Platform);
}

// Score validation removed - no longer scoring extractions

export interface FafData {
  readonly project?:
    | {
        readonly name?: string | undefined;
        readonly goal?: string | undefined;
        readonly main_language?: string | undefined;
      }
    | undefined;
  readonly stack?:
    | {
        readonly frontend?: string | undefined;
        readonly css_framework?: string | undefined;
        readonly ui_library?: string | undefined;
        readonly state_management?: string | undefined;
        readonly backend?: string | undefined;
        readonly runtime?: string | undefined;
        readonly database?: string | undefined;
        readonly build?: string | undefined;
        readonly package_manager?: string | undefined;
        readonly api_type?: string | undefined;
        readonly hosting?: string | undefined;
        readonly cicd?: string | undefined;
      }
    | undefined;
  readonly human_context?:
    | {
        readonly who?: string | undefined;
        readonly what?: string | undefined;
        readonly why?: string | undefined;
        readonly where?: string | undefined;
        readonly when?: string | undefined;
        readonly how?: string | undefined;
      }
    | undefined;
  readonly ai_score?: number | string;
  readonly ai_scoring_system?: string;
  readonly ai_scoring_details?: {
    readonly filled_slots?: number;
    readonly total_slots?: number;
  };
}

export interface SectionScore {
  readonly percentage: number;
  readonly filled: number;
  readonly total: number;
  readonly missing: readonly string[];
}

export type Confidence = 'LOW' | 'MODERATE' | 'GOOD' | 'HIGH' | 'VERY_HIGH';

export interface FafScore {
  readonly totalScore: number;
  readonly filledSlots: number;
  readonly totalSlots: number;
  readonly sectionScores: Readonly<Record<string, SectionScore>>;
  readonly suggestions: readonly string[];
  readonly confidence: Confidence;
}
