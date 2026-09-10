import test from 'node:test';
import assert from 'node:assert';
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

test('ORCHESTRATOR A: Safe first observation (trusted + clean → allowed)', () => {
  const { orchestrator } = setup();
  const decision = orchestrator.inspectSingleTool('calc', { name: 'eval', description: 'math' });
  
  assert.strictEqual(decision.integrityAction, 'pin');
  assert.strictEqual(decision.contentFlagged, false);
  assert.strictEqual(decision.exposureDecision, 'trusted');
  assert.strictEqual(decision.executionAllowed, true);

  const auth = orchestrator.authorizeToolCall('calc', 'eval');
  assert.strictEqual(auth.allowed, true);
});

test('ORCHESTRATOR B: Safe unchanged observation (trusted + clean → allowed)', () => {
  const { orchestrator } = setup();
  orchestrator.inspectSingleTool('calc', { name: 'eval', description: 'math' });
  const decision = orchestrator.inspectSingleTool('calc', { name: 'eval', description: 'math' });
  
  assert.strictEqual(decision.integrityAction, 'verify');
  assert.strictEqual(decision.exposureDecision, 'trusted');
  assert.strictEqual(decision.executionAllowed, true);

  assert.strictEqual(orchestrator.authorizeToolCall('calc', 'eval').allowed, true);
});

test('ORCHESTRATOR C: Manifest mutation (suspended + clean → blocked)', () => {
  const { orchestrator } = setup();
  orchestrator.inspectSingleTool('calc', { name: 'eval', description: 'math' });
  
  const decision = orchestrator.inspectSingleTool('calc', { name: 'eval', description: 'math 2' });
  
  assert.strictEqual(decision.integrityStatus, 'suspended');
  assert.strictEqual(decision.contentFlagged, false);
  assert.strictEqual(decision.exposureDecision, 'blocked'); // Integrity mismatch takes precedence
  assert.strictEqual(decision.executionAllowed, false);

  const auth = orchestrator.authorizeToolCall('calc', 'eval');
  assert.strictEqual(auth.allowed, false);
  assert.strictEqual(auth.reason, 'suspended');
});

test('ORCHESTRATOR D: Malicious first-time description (trusted + flagged → quarantined & blocked)', () => {
  const { orchestrator } = setup();
  // Pin a bad description
  const decision = orchestrator.inspectSingleTool('calc', { name: 'eval', description: 'hacked math' });
  
  assert.strictEqual(decision.integrityStatus, 'trusted'); // Integrity pinned successfully
  assert.strictEqual(decision.contentFlagged, true); // But content is bad
  assert.strictEqual(decision.exposureDecision, 'quarantined');
  assert.strictEqual(decision.executionAllowed, false);

  const auth = orchestrator.authorizeToolCall('calc', 'eval');
  assert.strictEqual(auth.allowed, false);
  assert.strictEqual(auth.reason, 'quarantined');
});

test('ORCHESTRATOR E: Manifest mutation + malicious description (suspended + flagged → blocked)', () => {
  const { orchestrator } = setup();
  orchestrator.inspectSingleTool('calc', { name: 'eval', description: 'math' });
  
  const decision = orchestrator.inspectSingleTool('calc', { name: 'eval', description: 'hacked math 2' });
  
  assert.strictEqual(decision.integrityStatus, 'suspended');
  assert.strictEqual(decision.contentFlagged, true);
  assert.strictEqual(decision.exposureDecision, 'blocked'); // Mismatch overrides quarantine
  assert.strictEqual(decision.executionAllowed, false);

  const auth = orchestrator.authorizeToolCall('calc', 'eval');
  assert.strictEqual(auth.allowed, false);
  assert.strictEqual(auth.reason, 'suspended');
});

test('ORCHESTRATOR F: Unknown tool call is blocked', () => {
  const { orchestrator } = setup();
  const auth = orchestrator.authorizeToolCall('calc', 'unknown_tool');
  assert.strictEqual(auth.allowed, false);
  assert.strictEqual(auth.reason, 'unknown');
});

test('ORCHESTRATOR G, H: Trusted vs Suspended tool calls', () => {
  const { orchestrator } = setup();
  orchestrator.inspectSingleTool('calc', { name: 'eval', description: 'math' });
  assert.strictEqual(orchestrator.authorizeToolCall('calc', 'eval').allowed, true); // H

  orchestrator.inspectSingleTool('calc', { name: 'eval', description: 'math 2' });
  assert.strictEqual(orchestrator.authorizeToolCall('calc', 'eval').allowed, false); // G
});

test('ORCHESTRATOR I: Reapproved tool', () => {
  const { orchestrator } = setup();
  orchestrator.inspectSingleTool('calc', { name: 'eval', description: 'math' });
  orchestrator.inspectSingleTool('calc', { name: 'eval', description: 'math 2' }); // suspends
  
  // Reapprove normal
  const decision = orchestrator.reapproveTool('calc', { name: 'eval', description: 'math 2' });
  assert.strictEqual(decision.integrityStatus, 'trusted');
  assert.strictEqual(decision.contentFlagged, false);
  assert.strictEqual(decision.exposureDecision, 'trusted');
  assert.strictEqual(orchestrator.authorizeToolCall('calc', 'eval').allowed, true);

  // Reapprove malicious
  const decision2 = orchestrator.reapproveTool('calc', { name: 'eval', description: 'hacked 3' });
  assert.strictEqual(decision2.integrityStatus, 'trusted');
  assert.strictEqual(decision2.contentFlagged, true);
  assert.strictEqual(decision2.exposureDecision, 'quarantined');
  assert.strictEqual(orchestrator.authorizeToolCall('calc', 'eval').reason, 'quarantined');
});

test('ORCHESTRATOR J: Server/tool isolation', () => {
  const { orchestrator } = setup();
  orchestrator.inspectSingleTool('calc', { name: 'eval', description: 'math' });
  orchestrator.inspectSingleTool('email', { name: 'send', description: 'hacked mail' });

  assert.strictEqual(orchestrator.authorizeToolCall('calc', 'eval').allowed, true);
  assert.strictEqual(orchestrator.authorizeToolCall('email', 'send').reason, 'quarantined');
});

test('ORCHESTRATOR K: Event emission correctness', () => {
  const { orchestrator, emitter } = setup();
  
  // 1. Pin + Clean
  orchestrator.inspectSingleTool('calc', { name: 'eval', description: 'math' });
  assert.ok(emitter.events.find(e => e.event === 'manifest_pinned'));
  
  emitter.clear();

  // 2. Mismatch + Clean
  orchestrator.inspectSingleTool('calc', { name: 'eval', description: 'math 2' });
  assert.ok(emitter.events.find(e => e.event === 'manifest_mismatch'));
  assert.ok(emitter.events.find(e => e.event === 'tool_suspended'));

  emitter.clear();

  // 3. Verify + Flagged
  orchestrator.reapproveTool('calc', { name: 'eval', description: 'math' }); // clears suspension
  emitter.clear();
  orchestrator.inspectSingleTool('calc', { name: 'eval', description: 'hacked' }); // mismatch + flagged
  assert.ok(emitter.events.find(e => e.event === 'manifest_mismatch'));
  assert.ok(emitter.events.find(e => e.event === 'detector_flagged'));

  emitter.clear();

  // 4. Reapprove
  orchestrator.reapproveTool('calc', { name: 'eval', description: 'hacked' });
  assert.ok(emitter.events.find(e => e.event === 'approved'));

  emitter.clear();

  // 5. Tool Call events
  orchestrator.authorizeToolCall('calc', 'eval');
  const callEvent = emitter.events.find(e => e.event === 'tool_call');
  assert.ok(callEvent);
  assert.strictEqual((callEvent?.details as any)?.allowed, false);
  assert.strictEqual((callEvent?.details as any)?.reason, 'quarantined');
});
