import { DecisionEngine } from '../engine/DecisionEngine';
import { DescriptionInspectionResult, OutputInspectionResult, SecurityAction, TextBlock } from '../types';

export interface MCPToolManifest {
  server?: string;
  tool?: string;
  name?: string;
  description?: string;
  inputSchema?: unknown;
}

export interface MCPToolResult {
  content?: string | TextBlock[];
  isError?: boolean;
}

export interface AdapterDescriptionResult {
  decision: SecurityAction;
  originalManifest: MCPToolManifest;
  modifiedManifest?: MCPToolManifest;
  details: DescriptionInspectionResult;
}

export interface AdapterOutputResult {
  decision: SecurityAction;
  originalResult: MCPToolResult;
  safeResult: MCPToolResult;
  details: OutputInspectionResult | { decision: SecurityAction, sanitized: boolean, severity: 'LOW', score: 0, reasons: [], removedSegments: 0, events: [] };
}

/**
 * THIN ADAPTER CONTRACT
 * Translates the team's MCP proxy data into the existing Person 3 public API.
 * Does NOT contain detection rules, sanitization logic, or risk calculation.
 */
export class ContentSecurityAdapter {
  constructor(private engine: DecisionEngine) {}

  public inspectToolManifest(
    manifest: MCPToolManifest,
    knownTools: string[] = [],
    workflowId?: string,
    dataId?: string
  ): AdapterDescriptionResult {
    // Fail-safe handling for invalid manifest descriptions
    if (!manifest || typeof manifest.description !== 'string') {
      return {
        decision: 'ALLOW',
        originalManifest: manifest,
        modifiedManifest: manifest,
        details: { decision: 'ALLOW', flagged: false, severity: 'LOW', score: 0, reasons: [], matches: [], events: [] }
      };
    }

    // Call existing engine
    const inspection = this.engine.inspectDescription({
      server: manifest.server,
      tool: manifest.tool || manifest.name,
      description: manifest.description,
      knownTools,
      workflowId,
      dataId
    });

    if (inspection.decision === 'BLOCK' || inspection.decision === 'QUARANTINE') {
      return {
        decision: inspection.decision,
        originalManifest: manifest,
        // Modified manifest is undefined because a blocked tool should be dropped
        details: inspection
      };
    }

    return {
      decision: inspection.decision,
      originalManifest: manifest,
      modifiedManifest: manifest, // Unchanged
      details: inspection
    };
  }

  public inspectToolResult(
    server: string,
    tool: string,
    result: MCPToolResult,
    knownTools: string[] = [],
    workflowId?: string,
    dataId?: string
  ): AdapterOutputResult {
    // Skip if no content to inspect
    if (!result || result.content === undefined || result.content === null) {
      return {
        decision: 'ALLOW',
        originalResult: result,
        safeResult: result,
        details: { decision: 'ALLOW', sanitized: false, severity: 'LOW', score: 0, reasons: [], removedSegments: 0, events: [] }
      };
    }

    if (typeof result.content === 'string') {
      const inspection = this.engine.inspectOutput({
        server,
        tool,
        content: result.content,
        knownTools,
        workflowId,
        dataId
      });

      return {
        decision: inspection.decision,
        originalResult: result,
        safeResult: {
          ...result,
          content: inspection.content
        },
        details: inspection
      };
    }

    if (Array.isArray(result.content)) {
      const blockInspection = this.engine.inspectTextBlocks(result.content as TextBlock[], {
        server,
        tool,
        knownTools,
        workflowId,
        dataId
      });

      return {
        decision: blockInspection.sanitized ? 'SANITIZE' : 'ALLOW',
        originalResult: result,
        safeResult: {
          ...result,
          content: blockInspection.blocks
        },
        details: { 
          decision: blockInspection.sanitized ? 'SANITIZE' : 'ALLOW', 
          sanitized: blockInspection.sanitized, 
          content: '',
          severity: blockInspection.sanitized ? 'CRITICAL' : 'LOW', 
          score: 0, 
          reasons: [], 
          removedSegments: 0, 
          events: blockInspection.events 
        }
      };
    }

    // Unrecognized content type fallback (Fail-safe: do not mutate, let proxy handle)
    return {
      decision: 'ALLOW',
      originalResult: result,
      safeResult: result,
      details: { decision: 'ALLOW', sanitized: false, severity: 'LOW', score: 0, reasons: [], removedSegments: 0, events: [] }
    };
  }
}
