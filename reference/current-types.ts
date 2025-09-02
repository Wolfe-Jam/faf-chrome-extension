/**
 * Current TypeScript Types - Reference for Production Build
 * Convert these to strict TypeScript with proper interfaces
 */

export type Platform = 'github' | 'monaco' | 'codemirror' | 'vscode-web' | 'stackblitz' | 'codesandbox' | 'localhost' | 'unknown';

export type Score = number; // Should be: 0 <= score <= 100

export interface FileStructure {
  files: string[];
  directories: string[];
  entryPoints: string[];
  totalFiles: number;
  totalLines: number;
}

export interface Dependencies {
  runtime: {
    language: string;
    version: string;
    packageManager: string;
  };
  packages: string[];
  devPackages: string[];
  lockFile: string | undefined;
}

export interface Environment {
  variables: string[];
  required: string[];
  optional: string[];
}

export interface Metadata {
  extractionTime: number;
  version: string;
  tags: string[];
}

export interface CodeContext {
  platform: Platform;
  score: Score;
  timestamp: number;
  structure: FileStructure;
  dependencies: Dependencies;
  environment: Environment;
  metadata: Metadata;
}

export interface FAFFile {
  version: string;
  generated: string;
  score: Score;
  context: CodeContext;
  summary: string;
  ai_instructions: string;
  checksum: string;
  compressed: boolean;
  size: number;
}

// Chrome Extension Types (need proper wrappers)
export interface Message {
  type: string;
  payload?: any;
  timestamp: number;
  source: 'popup' | 'content' | 'background';
}