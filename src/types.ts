export type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
export type ContentSource = 'tool_description' | 'tool_output';
export type SecurityAction = 'ALLOW' | 'FLAG' | 'SANITIZE' | 'BLOCK' | 'QUARANTINE';

export interface Signal {
  ruleId: string;
  category: string;
  text: string;
  start?: number;
  end?: number;
}

export interface SecurityEventDetails {
  sourceTool?: string;
  targetTool?: string;
  severity: RiskLevel;
  decision: SecurityAction;
  reasons: string[];
  removedSegments?: number;
}

export interface SecurityEvent {
  id: string;
  event: 'detector_flagged' | 'output_sanitized' | 'cross_tool_instruction_blocked' | 'inspection_failed';
  timestamp: string;
  server?: string;
  tool?: string;
  workflowId?: string;
  dataId?: string;
  details: SecurityEventDetails;
}

export interface DescriptionInspectionInput {
  server?: string;
  tool?: string;
  description: string;
  knownTools?: string[];
  workflowId?: string;
  dataId?: string;
  metadata?: Record<string, unknown>;
}

export interface OutputInspectionInput {
  server?: string;
  tool?: string;
  content: string;
  contentType?: string;
  knownTools?: string[];
  workflowId?: string;
  dataId?: string;
  metadata?: Record<string, unknown>;
}

export interface DescriptionInspectionResult {
  decision: SecurityAction;
  flagged: boolean;
  severity: RiskLevel;
  score: number;
  reasons: string[];
  matches: Signal[];
  events: SecurityEvent[];
}

export interface OutputInspectionResult {
  decision: SecurityAction;
  sanitized: boolean;
  content: string;
  severity: RiskLevel;
  score: number;
  reasons: string[];
  removedSegments: number;
  events: SecurityEvent[];
}

export interface DetectionResult {
  flagged: boolean;
  severity: RiskLevel;
  score: number;
  reasons: string[];
  matches: Signal[];
}

export interface TextBlock {
  type: 'text';
  text: string;
  [key: string]: unknown;
}

export interface SentinelConfig {
  descriptionBlockThreshold: RiskLevel;
  outputSanitizeThreshold: RiskLevel;
}
