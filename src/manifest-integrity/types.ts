export interface ToolManifest {
  server: string;
  tool: string;
  name: string;
  description: string;
  inputSchema: unknown;
}

export interface ApprovedBaseline {
  server: string;
  tool: string;
  hash: string;                   // SHA-256 fingerprint
  approvedAt: string;             // ISO-8601 timestamp
  originalManifest: ToolManifest; // Preserved for exact diff generation
}

export type IntegrityAction =
  | "pin"
  | "verify"
  | "suspend"
  | "reapprove";

export type IntegrityStatus = 
  | "trusted"
  | "suspended";

export interface ManifestDiff {
  path: string;                           // Nested paths supported
  type: "added" | "removed" | "changed";
  previous?: unknown;
  current?: unknown;
}

export interface IntegrityResult {
  server: string;
  tool: string;
  status: IntegrityStatus;
  action: IntegrityAction;
  currentHash: string;
  baselineHash?: string;
  diff?: ManifestDiff[];
}

export interface StoreEntry {
  baseline: ApprovedBaseline;
  status: IntegrityStatus;
}

export type ExecutionDecisionReason = "suspended" | "unknown" | "trusted";

export interface ExecutionDecision {
  allowed: boolean;
  server: string;
  tool: string;
  reason: ExecutionDecisionReason;
}
