/**
 * FAF Core Types - Strict TypeScript Definitions
 * Zero any types, complete type coverage
 */

export const PLATFORMS = ['github', 'gitlab', 'monaco', 'codemirror', 'vscode-web', 'stackblitz', 'codesandbox', 'codepen', 'localhost', 'has-code', 'unknown'] as const;
export type Platform = typeof PLATFORMS[number];

export const BRAND_COLORS = {
  orange: '#FF6B35',
  cream: '#FFF8F0',
  cyan: '#5CE1E6',
  black: '#0A0A0A'
} as const;

export const CONFIDENCE_LEVELS = ['VERY_HIGH', 'HIGH', 'GOOD', 'MODERATE', 'LOW'] as const;
export type ConfidenceLevel = typeof CONFIDENCE_LEVELS[number];

export interface BadgeColorConfig {
  readonly bg: string;
  readonly text: string;
}

export const BADGE_COLORS: Record<ConfidenceLevel, BadgeColorConfig> = {
  VERY_HIGH: { bg: BRAND_COLORS.orange, text: BRAND_COLORS.cream },
  HIGH: { bg: BRAND_COLORS.orange, text: BRAND_COLORS.cream },
  GOOD: { bg: BRAND_COLORS.cyan, text: BRAND_COLORS.black },
  MODERATE: { bg: BRAND_COLORS.cyan, text: BRAND_COLORS.black },
  LOW: { bg: BRAND_COLORS.black, text: BRAND_COLORS.orange }
} as const;

export type Score = number & { readonly __brand: 'Score' };

export function createScore(value: number): Score {
  const clamped = Math.min(100, Math.max(0, Math.round(value)));
  return clamped as Score;
}

export function getScoreValue(score: Score): number {
  return score as number;
}

export interface PlatformDetection {
  readonly platform: Platform;
  readonly baseScore: number;
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
}

export interface CodeContext {
  readonly platform: Platform;
  readonly score: Score;
  readonly structure: ProjectStructure;
  readonly dependencies: Dependencies;
  readonly environment: Environment;
  readonly metadata: ExtractionMetadata;
}

export interface FAFFile {
  readonly version: string;
  readonly generated: string;
  readonly score: Score;
  readonly context: CodeContext;
  readonly summary: string;
  readonly ai_instructions: string;
  readonly checksum: string;
  readonly compressed: boolean;
  readonly size: number;
}

export type ExtractionResult = {
  readonly success: true;
  readonly faf: FAFFile;
} | {
  readonly success: false;
  readonly error: string;
  readonly code: 'PLATFORM_NOT_SUPPORTED' | 'EXTRACTION_TIMEOUT' | 'DOM_ACCESS_ERROR' | 'UNKNOWN_ERROR';
};

export const MESSAGE_TYPES = [
  'EXTRACT_CONTEXT',
  'CONTEXT_EXTRACTED', 
  'COPY_TO_CLIPBOARD',
  'UPDATE_BADGE',
  'ERROR',
  'PING',
  'PONG'
] as const;

export type MessageType = typeof MESSAGE_TYPES[number];

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
  readonly payload: FAFFile;
}

export interface UpdateBadgeMessage extends BaseMessage {
  readonly type: 'UPDATE_BADGE';
  readonly payload: { readonly score: Score };
}

export interface ErrorMessage extends BaseMessage {
  readonly type: 'ERROR';
  readonly payload: {
    readonly error: string;
    readonly code: string;
    readonly stack?: string;
  };
}

export type Message = 
  | ExtractContextMessage
  | ContextExtractedMessage 
  | CopyToClipboardMessage
  | UpdateBadgeMessage
  | ErrorMessage;

export function isValidPlatform(value: string): value is Platform {
  return PLATFORMS.includes(value as Platform);
}

export function isValidScore(value: number): value is Score {
  return Number.isInteger(value) && value >= 0 && value <= 100;
}

export function getConfidenceLevel(score: Score): ConfidenceLevel {
  const value = getScoreValue(score);
  if (value >= 90) return 'VERY_HIGH';
  if (value >= 80) return 'HIGH';
  if (value >= 70) return 'GOOD';
  if (value >= 60) return 'MODERATE';
  return 'LOW';
}

export function getBadgeColors(score: Score): BadgeColorConfig {
  const confidence = getConfidenceLevel(score);
  return BADGE_COLORS[confidence];
}

export interface FafData {
  readonly project?: {
    readonly name?: string;
    readonly goal?: string;
    readonly main_language?: string;
  };
  readonly stack?: {
    readonly frontend?: string;
    readonly css_framework?: string;
    readonly ui_library?: string;
    readonly state_management?: string;
    readonly backend?: string;
    readonly runtime?: string;
    readonly database?: string;
    readonly build?: string;
    readonly package_manager?: string;
    readonly api_type?: string;
    readonly hosting?: string;
    readonly cicd?: string;
  };
  readonly human_context?: {
    readonly who?: string;
    readonly what?: string;
    readonly why?: string;
    readonly where?: string;
    readonly when?: string;
    readonly how?: string;
  };
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
