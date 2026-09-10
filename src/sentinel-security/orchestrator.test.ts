

import { SecurityOrchestrator } from './orchestrator.ts';
import { ManifestIntegrityBoundary } from '../manifest-integrity/index.ts';
import type { ContentDetector, ContentDetectorResult, EventEmitter, AuditEvent } from './contracts.ts';

// Mock implementations
class MockDetector implements ContentDetector {
  inspectDescription(server: string, toolName: string, description: string): ContentDetectorResult {
    if (description.includes('hacked')) {
      return { flagged: true, reasons: ['cross_tool_reference'] };
    }
    return { flagged: false, reasons: [] };
  }
}

class MockEventEmitter implements EventEmitter {
  public events: AuditEvent[] = [];
  emit(event: AuditEvent): void {
    this.events.push(event);
  }
  clear() {
    this.events = [];
  }
}

const setup = () => {
  const boundary = new ManifestIntegrityBoundary();
  const detector = new MockDetector();
  const emitter = new MockEventEmitter();
  const orchestrator = new SecurityOrchestrator(boundary, detector, emitter);
  return { orchestrator, emitter };
};

it('ORCHESTRATOR A: Safe first observation (trusted + clean → allowed)', () => {
  const { orchestrator } = setup();
  const decision = orchestrator.inspectSingleTool('calc', { name: 'eval', description: 'math' });
  
  expect(decision.integrityAction).toBe('pin');
  expect(decision.contentFlagged).toBe(false);
  expect(decision.exposureDecision).toBe('trusted');
  expect(decision.executionAllowed).toBe(true);

  const auth = orchestrator.authorizeToolCall('calc', 'eval');
  expect(auth.allowed).toBe(true);
});

it('ORCHESTRATOR B: Safe unchanged observation (trusted + clean → allowed)', () => {
  const { orchestrator } = setup();
  orchestrator.inspectSingleTool('calc', { name: 'eval', description: 'math' });
  const decision = orchestrator.inspectSingleTool('calc', { name: 'eval', description: 'math' });
  
  expect(decision.integrityAction).toBe('verify');
  expect(decision.exposureDecision).toBe('trusted');
  expect(decision.executionAllowed).toBe(true);

  expect(orchestrator.authorizeToolCall('calc', 'eval').allowed).toBe(true);
});

it('ORCHESTRATOR C: Manifest mutation (suspended + clean → blocked)', () => {
  const { orchestrator } = setup();
  orchestrator.inspectSingleTool('calc', { name: 'eval', description: 'math' });
  
  const decision = orchestrator.inspectSingleTool('calc', { name: 'eval', description: 'math 2' });
  
  expect(decision.integrityStatus).toBe('suspended');
  expect(decision.contentFlagged).toBe(false);
  expect(decision.exposureDecision).toBe('blocked'); // Integrity mismatch takes precedence
  expect(decision.executionAllowed).toBe(false);

  const auth = orchestrator.authorizeToolCall('calc', 'eval');
  expect(auth.allowed).toBe(false);
  expect(auth.reason).toBe('suspended');
});

it('ORCHESTRATOR D: Malicious first-time description (trusted + flagged → quarantined & blocked)', () => {
  const { orchestrator } = setup();
  // Pin a bad description
  const decision = orchestrator.inspectSingleTool('calc', { name: 'eval', description: 'hacked math' });
  
  expect(decision.integrityStatus).toBe('trusted'); // Integrity pinned successfully
  expect(decision.contentFlagged).toBe(true); // But content is bad
  expect(decision.exposureDecision).toBe('quarantined');
  expect(decision.executionAllowed).toBe(false);

  const auth = orchestrator.authorizeToolCall('calc', 'eval');
  expect(auth.allowed).toBe(false);
  expect(auth.reason).toBe('quarantined');
});

it('ORCHESTRATOR E: Manifest mutation + malicious description (suspended + flagged → blocked)', () => {
  const { orchestrator } = setup();
  orchestrator.inspectSingleTool('calc', { name: 'eval', description: 'math' });
  
  const decision = orchestrator.inspectSingleTool('calc', { name: 'eval', description: 'hacked math 2' });
  
  expect(decision.integrityStatus).toBe('suspended');
  expect(decision.contentFlagged).toBe(true);
  expect(decision.exposureDecision).toBe('blocked'); // Mismatch overrides quarantine
  expect(decision.executionAllowed).toBe(false);

  const auth = orchestrator.authorizeToolCall('calc', 'eval');
  expect(auth.allowed).toBe(false);
  expect(auth.reason).toBe('suspended');
});

it('ORCHESTRATOR F: Unknown tool call is blocked', () => {
  const { orchestrator } = setup();
  const auth = orchestrator.authorizeToolCall('calc', 'unknown_tool');
  expect(auth.allowed).toBe(false);
  expect(auth.reason).toBe('unknown');
});

it('ORCHESTRATOR G, H: Trusted vs Suspended tool calls', () => {
  const { orchestrator } = setup();
  orchestrator.inspectSingleTool('calc', { name: 'eval', description: 'math' });
  expect(orchestrator.authorizeToolCall('calc', 'eval').allowed).toBe(true); // H

  orchestrator.inspectSingleTool('calc', { name: 'eval', description: 'math 2' });
  expect(orchestrator.authorizeToolCall('calc', 'eval').allowed).toBe(false); // G
});

it('ORCHESTRATOR I: Reapproved tool', () => {
  const { orchestrator } = setup();
  orchestrator.inspectSingleTool('calc', { name: 'eval', description: 'math' });
  orchestrator.inspectSingleTool('calc', { name: 'eval', description: 'math 2' }); // suspends
  
  // Reapprove normal
  const decision = orchestrator.reapproveTool('calc', { name: 'eval', description: 'math 2' });
  expect(decision.integrityStatus).toBe('trusted');
  expect(decision.contentFlagged).toBe(false);
  expect(decision.exposureDecision).toBe('trusted');
  expect(orchestrator.authorizeToolCall('calc', 'eval').allowed).toBe(true);

  // Reapprove malicious
  const decision2 = orchestrator.reapproveTool('calc', { name: 'eval', description: 'hacked 3' });
  expect(decision2.integrityStatus).toBe('trusted');
  expect(decision2.contentFlagged).toBe(true);
  expect(decision2.exposureDecision).toBe('quarantined');
  expect(orchestrator.authorizeToolCall('calc', 'eval').reason).toBe('quarantined');
});

it('ORCHESTRATOR J: Server/tool isolation', () => {
  const { orchestrator } = setup();
  orchestrator.inspectSingleTool('calc', { name: 'eval', description: 'math' });
  orchestrator.inspectSingleTool('email', { name: 'send', description: 'hacked mail' });

  expect(orchestrator.authorizeToolCall('calc', 'eval').allowed).toBe(true);
  expect(orchestrator.authorizeToolCall('email', 'send').reason).toBe('quarantined');
});

it('ORCHESTRATOR K: Event emission correctness', () => {
  const { orchestrator, emitter } = setup();
  
  // 1. Pin + Clean
  orchestrator.inspectSingleTool('calc', { name: 'eval', description: 'math' });
  expect(emitter.events.find(e => e.event === 'manifest_pinned')).toBeTruthy();
  
  emitter.clear();

  // 2. Mismatch + Clean
  orchestrator.inspectSingleTool('calc', { name: 'eval', description: 'math 2' });
  expect(emitter.events.find(e => e.event === 'manifest_mismatch')).toBeTruthy();
  expect(emitter.events.find(e => e.event === 'tool_suspended')).toBeTruthy();

  emitter.clear();

  // 3. Verify + Flagged
  orchestrator.reapproveTool('calc', { name: 'eval', description: 'math' }); // clears suspension
  emitter.clear();
  orchestrator.inspectSingleTool('calc', { name: 'eval', description: 'hacked' }); // mismatch + flagged
  expect(emitter.events.find(e => e.event === 'manifest_mismatch')).toBeTruthy();
  expect(emitter.events.find(e => e.event === 'detector_flagged')).toBeTruthy();

  emitter.clear();

  // 4. Reapprove
  orchestrator.reapproveTool('calc', { name: 'eval', description: 'hacked' });
  expect(emitter.events.find(e => e.event === 'approved')).toBeTruthy();

  emitter.clear();

  // 5. Tool Call events
  orchestrator.authorizeToolCall('calc', 'eval');
  const callEvent = emitter.events.find(e => e.event === 'tool_call');
  expect(callEvent).toBeTruthy();
  expect((callEvent?.details as any)?.allowed).toBe(false);
  expect((callEvent?.details as any)?.reason).toBe('quarantined');
});
