export type KnownEventType =
  | 'tool_call'
  | 'tool_result'
  | 'manifest_pinned'
  | 'manifest_verified'
  | 'manifest_mismatch'
  | 'detector_flagged'
  | 'output_sanitized'
  | 'approved'
  | 'tool_suspended'
  | 'workflow_blocked';

export type EventType = KnownEventType | string;

// Incoming event from producers that might use either 'event' or 'type'
export interface IncomingEvent {
  id?: any;
  timestamp?: any;
  type?: any;
  event?: any;
  server?: any;
  tool?: any;
  workflowId?: any;
  dataId?: any;
  details?: any;
  [key: string]: any;
}

// Internal stable event model for the dashboard
export interface SentinelEvent {
  id: string;
  timestamp: number;
  type: EventType;
  server?: string;
  tool?: string;
  workflowId?: string;
  dataId?: string;
  details?: any;
}

function safeString(val: any): string | undefined {
  if (typeof val === 'string') return val.trim() || undefined;
  if (typeof val === 'number') return String(val);
  return undefined;
}

// Normalization / adapter boundary
export function normalizeEvent(raw: any): SentinelEvent {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return {
      id: crypto.randomUUID(),
      timestamp: Date.now(),
      type: 'unknown'
    };
  }

  // Use type if available, fallback to event
  let resolvedType = raw.type || raw.event;
  if (typeof resolvedType !== 'string' || !resolvedType.trim()) {
    resolvedType = 'unknown';
  }

  let ts = Date.now();
  if (typeof raw.timestamp === 'number' && !isNaN(raw.timestamp)) {
    ts = raw.timestamp;
  } else if (typeof raw.timestamp === 'string') {
    const parsed = new Date(raw.timestamp).getTime();
    if (!isNaN(parsed)) ts = parsed;
  }

  return {
    id: safeString(raw.id) || crypto.randomUUID(),
    timestamp: ts,
    type: resolvedType,
    server: safeString(raw.server),
    tool: safeString(raw.tool),
    workflowId: safeString(raw.workflowId),
    dataId: safeString(raw.dataId),
    details: raw.details !== undefined ? raw.details : undefined,
  };
}
