/**
 * Person 3 Contract: Content Detector
 * Protects the agent from malicious instructions inside tool descriptions.
 */
export interface ContentDetectorResult {
  flagged: boolean;
  reasons: string[];
}

export interface ContentDetector {
  inspectDescription(server: string, toolName: string, description: string): ContentDetectorResult;
}

/**
 * Person 4 Contract: Event System
 * Standardized audit events for dashboard and observability.
 */
export type AuditEventType = 
  | 'manifest_pinned' 
  | 'manifest_verified' 
  | 'manifest_mismatch' 
  | 'detector_flagged' 
  | 'approved' 
  | 'tool_call' 
  | 'tool_suspended'
  | 'output_sanitized';

export interface AuditEvent {
  id: string;
  timestamp: string;
  event: AuditEventType;
  server: string;
  tool: string;
  workflowId?: string;
  dataId?: string | null;
  details?: Record<string, unknown>;
}

export interface EventEmitter {
  emit(event: AuditEvent): void;
}
