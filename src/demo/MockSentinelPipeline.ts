import { Sentinel } from '../index';
import { SecurityAction, SecurityEvent } from '../types';

/**
 * MOCK SENTINEL PIPELINE
 * 
 * This is a local integration contract harness.
 * It simulates the data crossing the future Sentinel Proxy boundary.
 * It is NOT the real MCP transport.
 * 
 * CURRENT: MockSentinelPipeline -> Person 3
 * LATER: Real Sentinel Proxy -> Person 3
 */

export interface MockManifest {
  server: string;
  tool: string;
  name: string;
  description: string;
  inputSchema?: any;
}

export interface MockToolResult {
  content: string;
  isError?: boolean;
}

export class MockSentinelPipeline {
  private events: SecurityEvent[] = [];
  private unsubscribe: () => void;

  constructor() {
    this.unsubscribe = Sentinel.onEvent((event) => {
      this.events.push(event);
    });
  }

  public getCapturedEvents(): SecurityEvent[] {
    return this.events;
  }

  public clearEvents(): void {
    this.events = [];
  }

  public shutdown(): void {
    this.unsubscribe();
  }

  /**
   * Simulates interception of tools/list payloads
   */
  public inspectToolManifest(manifest: MockManifest, knownTools: string[]): { decision: SecurityAction, modifiedManifest?: MockManifest } {
    const result = Sentinel.inspectDescription({
      server: manifest.server,
      tool: manifest.tool,
      description: manifest.description,
      knownTools,
      workflowId: 'wf-mock-001',
      dataId: 'data-mock-001'
    });

    if (result.decision === 'BLOCK' || result.decision === 'QUARANTINE') {
      // In a real proxy, this tool would be dropped from the tools/list array entirely
      return { decision: result.decision };
    }

    return { decision: result.decision, modifiedManifest: manifest };
  }

  /**
   * Simulates interception of tools/call results
   */
  public inspectToolResult(server: string, tool: string, resultContent: string, knownTools: string[]): { decision: SecurityAction, safeResult: string } {
    const result = Sentinel.inspectOutput({
      server,
      tool,
      content: resultContent,
      knownTools,
      workflowId: 'wf-mock-002',
      dataId: 'data-mock-002'
    });

    return {
      decision: result.decision,
      safeResult: result.content
    };
  }
}
