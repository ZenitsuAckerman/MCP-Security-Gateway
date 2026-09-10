import { ManifestIntegrityBoundary, type McpToolLike } from '../manifest-integrity/index.ts';
import type { ManifestDiff, IntegrityAction } from '../manifest-integrity/types.ts';
import type { ContentDetector, EventEmitter, AuditEvent } from './contracts.ts';

export interface SecurityDecision {
  integrityStatus: 'trusted' | 'suspended';
  integrityAction: IntegrityAction;
  diff?: ManifestDiff[];
  
  contentFlagged: boolean;
  contentReasons: string[];

  exposureDecision: 'trusted' | 'quarantined' | 'blocked';
  executionAllowed: boolean;
}

export interface OrchestratorExecutionDecision {
  allowed: boolean;
  server: string;
  tool: string;
  reason: 'suspended' | 'unknown' | 'trusted' | 'quarantined';
}

/**
 * The unified Sentinel Security Orchestrator.
 * It combines Person 2's integrity boundary and Person 3's content detection,
 * while emitting Person 4's standardized events.
 */
export class SecurityOrchestrator {
  // Ephemeral state holding the latest detector result to enforce quarantine during tools/call.
  // This does NOT replace the baseline store and is intentionally ephemeral.
  private contentQuarantineStore = new Map<string, boolean>();
  private integrityBoundary: ManifestIntegrityBoundary;
  private detector: ContentDetector;
  private eventEmitter: EventEmitter;

  constructor(
    integrityBoundary: ManifestIntegrityBoundary,
    detector: ContentDetector,
    eventEmitter: EventEmitter
  ) {
    this.integrityBoundary = integrityBoundary;
    this.detector = detector;
    this.eventEmitter = eventEmitter;
  }

  /**
   * tools/list Orchestration
   * Evaluates both integrity and content safety for a batch of tools.
   */
  inspectTools(server: string, tools: McpToolLike[]): SecurityDecision[] {
    return tools.map(tool => this.inspectSingleTool(server, tool));
  }

  /**
   * Evaluates a single tool manifest.
   */
  inspectSingleTool(server: string, tool: McpToolLike): SecurityDecision {
    // 1. Run Manifest Integrity observation
    const integrityResult = this.integrityBoundary.observeTool(server, tool);

    // Emit integrity events
    if (integrityResult.action === 'pin') {
      this.emitEvent('manifest_pinned', server, tool.name);
    } else if (integrityResult.action === 'verify') {
      this.emitEvent('manifest_verified', server, tool.name);
    } else if (integrityResult.action === 'suspend') {
      this.emitEvent('manifest_mismatch', server, tool.name, { diff: integrityResult.diff });
      this.emitEvent('tool_suspended', server, tool.name);
    }

    // 2. Run Description Detector
    const description = typeof tool.description === 'string' ? tool.description : '';
    const detectorResult = this.detector.inspectDescription(server, tool.name, description);

    if (detectorResult.flagged) {
      this.emitEvent('detector_flagged', server, tool.name, { reasons: detectorResult.reasons });
    }

    // 3. Update quarantine store
    const key = `${server}:${tool.name}`;
    this.contentQuarantineStore.set(key, detectorResult.flagged);

    // 4. Determine final hierarchical decision
    let exposureDecision: 'trusted' | 'quarantined' | 'blocked';
    let executionAllowed: boolean;

    if (integrityResult.status === 'suspended') {
      // Integrity mismatch always takes ultimate precedence
      exposureDecision = 'blocked';
      executionAllowed = false;
    } else if (detectorResult.flagged) {
      // Integrity verifies, but content is malicious
      exposureDecision = 'quarantined';
      executionAllowed = false;
    } else {
      // Both cleanly pass
      exposureDecision = 'trusted';
      executionAllowed = true;
    }

    return {
      integrityStatus: integrityResult.status,
      integrityAction: integrityResult.action,
      diff: integrityResult.diff,
      contentFlagged: detectorResult.flagged,
      contentReasons: detectorResult.reasons,
      exposureDecision,
      executionAllowed
    };
  }

  /**
   * tools/call Orchestration
   * Authorizes execution based on both Integrity and Quarantine state.
   */
  authorizeToolCall(server: string, toolName: string): OrchestratorExecutionDecision {
    // A. Check existing ManifestIntegrityBoundary
    const integrityDecision = this.integrityBoundary.canExecuteTool(server, toolName);

    // B. If integrity is not executable (suspended or unknown), block immediately.
    if (!integrityDecision.allowed) {
      this.emitEvent('tool_call', server, toolName, { allowed: false, reason: integrityDecision.reason });
      return {
        allowed: false,
        server,
        tool: toolName,
        reason: integrityDecision.reason as 'suspended' | 'unknown'
      };
    }

    // C. Check the orchestrator's current content-security state
    const key = `${server}:${toolName}`;
    const isFlagged = this.contentQuarantineStore.get(key) === true;

    // D. If flagged, block with explicit quarantine reason
    if (isFlagged) {
      this.emitEvent('tool_call', server, toolName, { allowed: false, reason: 'quarantined' });
      return {
        allowed: false,
        server,
        tool: toolName,
        reason: 'quarantined'
      };
    }

    // E. Otherwise fully allowed
    this.emitEvent('tool_call', server, toolName, { allowed: true });
    return {
      allowed: true,
      server,
      tool: toolName,
      reason: 'trusted'
    };
  }

  /**
   * Explicitly reapproves an integrity baseline and resets its quarantine state.
   */
  reapproveTool(server: string, tool: McpToolLike): SecurityDecision {
    const result = this.integrityBoundary.reapproveTool(server, tool);
    this.emitEvent('approved', server, tool.name);
    
    // Rerun content detection to set the correct quarantine state for the newly approved tool
    const description = typeof tool.description === 'string' ? tool.description : '';
    const detectorResult = this.detector.inspectDescription(server, tool.name, description);
    this.contentQuarantineStore.set(`${server}:${tool.name}`, detectorResult.flagged);

    let exposureDecision: 'trusted' | 'quarantined' | 'blocked';
    let executionAllowed: boolean;

    if (detectorResult.flagged) {
      exposureDecision = 'quarantined';
      executionAllowed = false;
    } else {
      exposureDecision = 'trusted';
      executionAllowed = true;
    }

    return {
      integrityStatus: result.status,
      integrityAction: result.action,
      diff: result.diff,
      contentFlagged: detectorResult.flagged,
      contentReasons: detectorResult.reasons,
      exposureDecision,
      executionAllowed
    };
  }

  private emitEvent(event: AuditEvent['event'], server: string, tool: string, details?: Record<string, unknown>) {
    this.eventEmitter.emit({
      id: `evt-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      timestamp: new Date().toISOString(),
      event,
      server,
      tool,
      details
    });
  }
}
