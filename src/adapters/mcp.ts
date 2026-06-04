/**
 * FAF MCP (Model Context Protocol) Adapter
 * Connects Chrome Extension to local FAF MCP servers
 */

import { FAFError, FAFErrorCode } from '@/core/errors';
import type { CodeContext } from '@/core/types';

export interface MCPResponse {
  jsonrpc: '2.0';
  id: number;
  result?: any;
  error?: {
    code: number;
    message: string;
    data?: any;
  };
}

export interface MCPRequest {
  jsonrpc: '2.0';
  id: number;
  method: string;
  params?: any;
}

export class MCPAdapter {
  private readonly baseUrl = 'http://localhost:3457';
  private requestId = 1;

  constructor(private readonly debug = false) {}

  /**
   * Check if MCP server is available
   */
  async isAvailable(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/health`, {
        method: 'GET',
        signal: AbortSignal.timeout(2000), // 2s timeout
      });
      return response.ok;
    } catch (error) {
      if (this.debug) {
        console.debug('[FAF MCP] Server not available:', error);
      }
      return false;
    }
  }

  /**
   * List available MCP tools
   */
  async listTools(): Promise<string[]> {
    const response = await this.sendMCPRequest('tools/list', {});
    if (response.error) {
      throw new FAFError(
        FAFErrorCode.MCP_ERROR,
        `Failed to list MCP tools: ${response.error.message}`,
        { technicalDetails: JSON.stringify(response.error) }
      );
    }
    return response.result?.tools?.map((tool: any) => tool.name) || [];
  }

  /**
   * Get project status via faf_status
   */
  async getProjectStatus(path?: string): Promise<any> {
    return this.callTool('faf_status', { path });
  }

  /**
   * Score context quality via faf_score
   */
  async scoreContext(context: string, details = false): Promise<any> {
    return this.callTool('faf_score', { context, details });
  }

  /**
   * Initialize FAF project via faf_init
   */
  async initializeProject(force = false): Promise<any> {
    return this.callTool('faf_init', { force });
  }

  /**
   * Enhance context via faf_enhance
   */
  async enhanceContext(
    context: string,
    model: 'claude' | 'chatgpt' | 'gemini' | 'big3' | 'universal' = 'universal',
    focus?: string
  ): Promise<any> {
    return this.callTool('faf_enhance', { context, model, focus });
  }

  /**
   * Sync context via faf_sync
   */
  async syncContext(): Promise<any> {
    return this.callTool('faf_sync', {});
  }

  /**
   * Bi-directional sync via faf_bi_sync
   */
  async biDirectionalSync(): Promise<any> {
    return this.callTool('faf_bi_sync', {});
  }

  /**
   * Clear context via faf_clear
   */
  async clearContext(): Promise<any> {
    return this.callTool('faf_clear', {});
  }

  /**
   * Verify trust via faf_trust
   */
  async verifyTrust(): Promise<any> {
    return this.callTool('faf_trust', {});
  }

  /**
   * Generic tool call
   */
  async callTool(name: string, args: Record<string, any>): Promise<any> {
    const response = await this.sendMCPRequest('tools/call', {
      name,
      arguments: args,
    });

    if (response.error) {
      throw new FAFError(
        FAFErrorCode.MCP_ERROR,
        `MCP tool '${name}' failed: ${response.error.message}`,
        {
          technicalDetails: `tool=${name} args=${JSON.stringify(args)} error=${JSON.stringify(response.error)}`,
        }
      );
    }

    return response.result;
  }

  /**
   * Send MCP request to HTTP server
   */
  private async sendMCPRequest(method: string, params: any): Promise<MCPResponse> {
    const request: MCPRequest = {
      jsonrpc: '2.0',
      id: this.requestId++,
      method,
      params,
    };

    try {
      const response = await fetch(`${this.baseUrl}/mcp/request`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(request),
        signal: AbortSignal.timeout(30000), // 30s timeout for tool calls
      });

      if (!response.ok) {
        throw new FAFError(
          FAFErrorCode.NETWORK_ERROR,
          `MCP HTTP error: ${response.status} ${response.statusText}`,
          { technicalDetails: `status=${response.status} url=${response.url}` }
        );
      }

      const mcpResponse: MCPResponse = await response.json();

      if (this.debug) {
        console.debug('[FAF MCP] Request:', request);
        console.debug('[FAF MCP] Response:', mcpResponse);
      }

      return mcpResponse;
    } catch (error) {
      if (error instanceof FAFError) {
        throw error;
      }

      throw new FAFError(
        FAFErrorCode.MCP_ERROR,
        `MCP request failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        {
          cause: error instanceof Error ? error : undefined,
          technicalDetails: `method=${method} params=${JSON.stringify(params)}`,
        }
      );
    }
  }
}

/**
 * Enhanced Context with MCP integration
 */
export class MCPEnhancedContext {
  constructor(
    private readonly mcp: MCPAdapter,
    private readonly debug = false
  ) {}

  /**
   * Process extracted context through MCP pipeline
   */
  async processContext(context: CodeContext): Promise<CodeContext> {
    try {
      // Check MCP availability
      if (!(await this.mcp.isAvailable())) {
        if (this.debug) {
          console.warn('[FAF MCP] Server unavailable, returning original context');
        }
        return context;
      }

      // Score original context
      const originalScore = await this.mcp.scoreContext(JSON.stringify(context), true);

      // Enhance context if score is below threshold
      let enhancedContext = context;
      if (originalScore?.score < 85) {
        const enhancementResult = await this.mcp.enhanceContext(
          JSON.stringify(context),
          'universal',
          'human-context'
        );

        if (enhancementResult?.enhanced_context) {
          try {
            enhancedContext = JSON.parse(enhancementResult.enhanced_context);
          } catch {
            console.warn('[FAF MCP] Failed to parse enhanced context, using original');
          }
        }
      }

      // Add MCP metadata
      return {
        ...enhancedContext,
        metadata: {
          ...enhancedContext.metadata,
          mcpProcessed: true,
          mcpScore: originalScore,
          mcpEnhanced: originalScore?.score < 85,
          mcpTimestamp: new Date().toISOString(),
        },
      };
    } catch (error) {
      if (this.debug) {
        console.warn('[FAF MCP] Context processing failed:', error);
      }
      return context; // Return original context on error
    }
  }

  /**
   * Sync processed context with local FAF system
   */
  async syncToLocal(_context: CodeContext): Promise<boolean> {
    try {
      if (!(await this.mcp.isAvailable())) {
        return false;
      }

      await this.mcp.biDirectionalSync();
      return true;
    } catch (error) {
      if (this.debug) {
        console.warn('[FAF MCP] Sync to local failed:', error);
      }
      return false;
    }
  }
}
