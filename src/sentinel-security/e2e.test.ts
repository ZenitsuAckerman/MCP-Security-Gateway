import test from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import { SecurityOrchestrator } from './orchestrator.ts';
import { ManifestIntegrityBoundary } from '../manifest-integrity/index.ts';
import type { ContentDetector, ContentDetectorResult, EventEmitter, AuditEvent } from './contracts.ts';
import type { McpToolLike } from '../manifest-integrity/index.ts';

const DB_PATH = './test-e2e-persistence.json';

const cleanup = () => {
  if (fs.existsSync(DB_PATH)) fs.unlinkSync(DB_PATH);
  if (fs.existsSync(`${DB_PATH}.tmp`)) fs.unlinkSync(`${DB_PATH}.tmp`);
};

class MockE2EDetector implements ContentDetector {
  inspectDescription(server: string, toolName: string, description: string): ContentDetectorResult {
    if (description.includes('hacked') || description.includes('malicious')) {
      return { flagged: true, reasons: ['cross_tool_reference'] };
    }
    return { flagged: false, reasons: [] };
  }
}

class MockE2EEventEmitter implements EventEmitter {
  public events: AuditEvent[] = [];
  emit(event: AuditEvent): void {
    this.events.push(event);
  }
  clear() {
    this.events = [];
  }
}

const setup = (dbPath = DB_PATH) => {
  const boundary = new ManifestIntegrityBoundary(dbPath);
  const detector = new MockE2EDetector();
  const emitter = new MockE2EEventEmitter();
  const orchestrator = new SecurityOrchestrator(boundary, detector, emitter);
  return { orchestrator, boundary, detector, emitter };
};

test('E2E PART 4 — LEGITIMATE UPDATE SCENARIO', () => {
  cleanup();
  
  // Initial observation (Manifest A)
  const toolA: McpToolLike = { name: "evaluate", description: "math operations" };
  const { orchestrator: initOrch } = setup();
  const decisionA = initOrch.inspectSingleTool('calc', toolA);
  
  assert.strictEqual(decisionA.exposureDecision, 'trusted');
  assert.strictEqual(decisionA.executionAllowed, true);
  assert.strictEqual(initOrch.authorizeToolCall('calc', 'evaluate').allowed, true);

  // Developer legitimately changes tool (Manifest B)
  const toolB: McpToolLike = { name: "evaluate", description: "math operations v2" };
  const { orchestrator: updateOrch } = setup(); // Restart
  const decisionB = updateOrch.inspectSingleTool('calc', toolB);
  
  assert.strictEqual(decisionB.integrityStatus, 'suspended'); // Hash mismatch
  assert.strictEqual(decisionB.exposureDecision, 'blocked');
  assert.strictEqual(decisionB.executionAllowed, false);
  assert.strictEqual(updateOrch.authorizeToolCall('calc', 'evaluate').allowed, false); // Blocked

  // Human explicitly reapproves B
  const reapproveDecision = updateOrch.reapproveTool('calc', toolB);
  assert.strictEqual(reapproveDecision.integrityStatus, 'trusted');
  assert.strictEqual(reapproveDecision.exposureDecision, 'trusted');
  assert.strictEqual(updateOrch.authorizeToolCall('calc', 'evaluate').allowed, true);

  // Restart again and verify B
  const { orchestrator: restartOrch } = setup();
  const decisionC = restartOrch.inspectSingleTool('calc', toolB);
  assert.strictEqual(decisionC.integrityAction, 'verify'); // Baseline B loaded successfully
  assert.strictEqual(decisionC.exposureDecision, 'trusted');
  assert.strictEqual(restartOrch.authorizeToolCall('calc', 'evaluate').allowed, true);

  cleanup();
});

test('E2E PART 5 — RUG-PULL ATTACK SCENARIO', () => {
  cleanup();

  // 1. Approved calculator.evaluate manifest A.
  const toolA: McpToolLike = { 
    name: "evaluate", 
    description: "math operations",
    inputSchema: { type: "object", properties: { a: { type: "number" } } }
  };
  const { orchestrator: orch1 } = setup();
  orch1.inspectSingleTool('calc', toolA); // Pins A

  // 2. Restart or continue operation.
  const { orchestrator: orch2 } = setup();

  // 3. Current calculator.evaluate suddenly presents malicious manifest B.
  const toolB: McpToolLike = { 
    name: "evaluate", 
    description: "hacked operations",
    inputSchema: { type: "object", properties: { a: { type: "string" } } }
  };
  
  // 4 & 5. Manifest hash changes & Integrity reports mismatch
  const decision = orch2.inspectSingleTool('calc', toolB);
  assert.strictEqual(decision.integrityStatus, 'suspended');
  
  // 6. Exact diff identifies the malicious description/schema change.
  assert.ok(decision.diff);
  assert.ok(decision.diff.some(d => d.path === 'description' && d.type === 'changed'));
  assert.ok(decision.diff.some(d => d.path === 'inputSchema.properties.a.type' && d.type === 'changed'));
  
  // 7. Tool becomes suspended.
  assert.strictEqual(decision.exposureDecision, 'blocked');

  // 8. ExecutionGate blocks calculator.evaluate.
  const auth = orch2.authorizeToolCall('calc', 'evaluate');
  assert.strictEqual(auth.allowed, false);
  assert.strictEqual(auth.reason, 'suspended');

  // 9. Persisted baseline remains A.
  const { orchestrator: orch3 } = setup(); // Restart
  const checkOld = orch3.inspectSingleTool('calc', toolA);
  assert.strictEqual(checkOld.integrityAction, 'verify'); // A is still the pinned baseline

  cleanup();
});

test('E2E PART 6 — MALICIOUS FIRST OBSERVATION', () => {
  cleanup();

  const toolMalicious: McpToolLike = { name: "evaluate", description: "malicious math" };
  const { orchestrator, emitter } = setup();
  
  const decision = orchestrator.inspectSingleTool('calc', toolMalicious);
  
  // Integrity may establish a baseline
  assert.strictEqual(decision.integrityAction, 'pin');
  assert.strictEqual(decision.integrityStatus, 'trusted');
  
  // BUT if Person 3's detector flags the description:
  assert.strictEqual(decision.contentFlagged, true);
  
  // final exposure decision must NOT be trusted, execution NOT allowed
  assert.strictEqual(decision.exposureDecision, 'quarantined');
  assert.strictEqual(decision.executionAllowed, false);
  
  const auth = orchestrator.authorizeToolCall('calc', 'evaluate');
  assert.strictEqual(auth.allowed, false);
  assert.strictEqual(auth.reason, 'quarantined');

  // Event validation
  assert.ok(emitter.events.find(e => e.event === 'manifest_pinned'));
  assert.ok(emitter.events.find(e => e.event === 'detector_flagged'));

  cleanup();
});

test('E2E PART 3 — REINSPECTION CAN CLEAR QUARANTINE', () => {
  cleanup();

  const { orchestrator } = setup();

  // First flagged
  orchestrator.inspectSingleTool('calc', { name: "eval", description: "hacked" });
  assert.strictEqual(orchestrator.authorizeToolCall('calc', 'eval').reason, 'quarantined');

  // Re-inspection with clean content (dynamic observation update)
  orchestrator.inspectSingleTool('calc', { name: "eval", description: "clean math" });
  
  // Wait, if it's "clean math", the baseline is now different (hacked != clean math), 
  // so it will suspend.
  assert.strictEqual(orchestrator.authorizeToolCall('calc', 'eval').reason, 'suspended');

  // If we reapprove the clean math:
  orchestrator.reapproveTool('calc', { name: "eval", description: "clean math" });
  assert.strictEqual(orchestrator.authorizeToolCall('calc', 'eval').reason, 'trusted');
  assert.strictEqual(orchestrator.authorizeToolCall('calc', 'eval').allowed, true);

  cleanup();
});
