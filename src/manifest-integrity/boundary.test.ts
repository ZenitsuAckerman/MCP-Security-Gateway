import test from 'node:test';
import assert from 'node:assert';
import { ManifestIntegrityBoundary } from './boundary.ts';
import type { McpToolLike } from './adapter.ts';

const deepClone = <T>(obj: T): T => JSON.parse(JSON.stringify(obj));

test('INTEGRATION BOUNDARY — First tool observation (pins)', () => {
  const boundary = new ManifestIntegrityBoundary();
  const tool: McpToolLike = { name: "eval", description: "math" };
  
  const result = boundary.observeTool("calc", tool);
  assert.strictEqual(result.action, "pin");
  assert.strictEqual(result.status, "trusted");
  
  // Execution allowed
  const decision = boundary.canExecuteTool("calc", "eval");
  assert.strictEqual(decision.allowed, true);
});

test('INTEGRATION BOUNDARY — Unchanged tool (verifies)', () => {
  const boundary = new ManifestIntegrityBoundary();
  const tool: McpToolLike = { name: "eval", description: "math" };
  
  boundary.observeTool("calc", tool);
  
  const result = boundary.observeTool("calc", deepClone(tool));
  assert.strictEqual(result.action, "verify");
  assert.strictEqual(result.status, "trusted");
});

test('INTEGRATION BOUNDARY — Description mutation (suspends and blocks)', () => {
  const boundary = new ManifestIntegrityBoundary();
  const tool: McpToolLike = { name: "eval", description: "math" };
  
  boundary.observeTool("calc", tool);
  
  const mutated: McpToolLike = { name: "eval", description: "math hacked" };
  const result = boundary.observeTool("calc", mutated);
  
  assert.strictEqual(result.action, "suspend");
  assert.strictEqual(result.status, "suspended");
  assert.ok(result.diff!.some(d => d.path === "description" && d.type === "changed"));

  // Execution blocked
  const decision = boundary.canExecuteTool("calc", "eval");
  assert.strictEqual(decision.allowed, false);
  assert.strictEqual(decision.reason, "suspended");
});

test('INTEGRATION BOUNDARY — InputSchema mutation (suspends and blocks)', () => {
  const boundary = new ManifestIntegrityBoundary();
  const tool: McpToolLike = { 
    name: "eval", 
    description: "math",
    inputSchema: { type: "object", properties: { a: { type: "string" } } }
  };
  
  boundary.observeTool("calc", tool);
  
  const mutated = deepClone(tool);
  (mutated.inputSchema as any).properties.a.type = "number";

  const result = boundary.observeTool("calc", mutated);
  assert.strictEqual(result.action, "suspend");
  assert.strictEqual(result.status, "suspended");

  // Execution blocked
  const decision = boundary.canExecuteTool("calc", "eval");
  assert.strictEqual(decision.allowed, false);
});

test('INTEGRATION BOUNDARY — Reapproved tool becomes executable', () => {
  const boundary = new ManifestIntegrityBoundary();
  const tool: McpToolLike = { name: "eval", description: "math" };
  
  boundary.observeTool("calc", tool);
  
  const mutated: McpToolLike = { name: "eval", description: "math upgraded" };
  boundary.observeTool("calc", mutated); // suspends
  
  assert.strictEqual(boundary.canExecuteTool("calc", "eval").allowed, false);

  const reapproveResult = boundary.reapproveTool("calc", mutated);
  assert.strictEqual(reapproveResult.action, "reapprove");
  assert.strictEqual(reapproveResult.status, "trusted");

  // Execution restored
  assert.strictEqual(boundary.canExecuteTool("calc", "eval").allowed, true);
});

test('INTEGRATION BOUNDARY — Server/tool isolation', () => {
  const boundary = new ManifestIntegrityBoundary();
  const toolCalc: McpToolLike = { name: "eval", description: "math" };
  const toolEmail: McpToolLike = { name: "send", description: "mail" };
  
  boundary.observeTool("calc", toolCalc);
  boundary.observeTool("email", toolEmail);
  
  const mutatedCalc = deepClone(toolCalc);
  mutatedCalc.description = "hacked math";
  
  boundary.observeTool("calc", mutatedCalc); // suspends calc/eval
  
  assert.strictEqual(boundary.canExecuteTool("calc", "eval").allowed, false);
  assert.strictEqual(boundary.canExecuteTool("email", "send").allowed, true); // unaffected
});
