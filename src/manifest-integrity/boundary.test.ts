

import { ManifestIntegrityBoundary } from './boundary.ts';
import type { McpToolLike } from './adapter.ts';

const deepClone = <T>(obj: T): T => JSON.parse(JSON.stringify(obj));

it('INTEGRATION BOUNDARY — First tool observation (pins)', () => {
  const boundary = new ManifestIntegrityBoundary();
  const tool: McpToolLike = { name: "eval", description: "math" };
  
  const result = boundary.observeTool("calc", tool);
  expect(result.action).toBe("pin");
  expect(result.status).toBe("trusted");
  
  // Execution allowed
  const decision = boundary.canExecuteTool("calc", "eval");
  expect(decision.allowed).toBe(true);
});

it('INTEGRATION BOUNDARY — Unchanged tool (verifies)', () => {
  const boundary = new ManifestIntegrityBoundary();
  const tool: McpToolLike = { name: "eval", description: "math" };
  
  boundary.observeTool("calc", tool);
  
  const result = boundary.observeTool("calc", deepClone(tool));
  expect(result.action).toBe("verify");
  expect(result.status).toBe("trusted");
});

it('INTEGRATION BOUNDARY — Description mutation (suspends and blocks)', () => {
  const boundary = new ManifestIntegrityBoundary();
  const tool: McpToolLike = { name: "eval", description: "math" };
  
  boundary.observeTool("calc", tool);
  
  const mutated: McpToolLike = { name: "eval", description: "math hacked" };
  const result = boundary.observeTool("calc", mutated);
  
  expect(result.action).toBe("suspend");
  expect(result.status).toBe("suspended");
  expect(result.diff!.some(d => d.path === "description" && d.type === "changed")).toBeTruthy();

  // Execution blocked
  const decision = boundary.canExecuteTool("calc", "eval");
  expect(decision.allowed).toBe(false);
  expect(decision.reason).toBe("suspended");
});

it('INTEGRATION BOUNDARY — InputSchema mutation (suspends and blocks)', () => {
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
  expect(result.action).toBe("suspend");
  expect(result.status).toBe("suspended");

  // Execution blocked
  const decision = boundary.canExecuteTool("calc", "eval");
  expect(decision.allowed).toBe(false);
});

it('INTEGRATION BOUNDARY — Reapproved tool becomes executable', () => {
  const boundary = new ManifestIntegrityBoundary();
  const tool: McpToolLike = { name: "eval", description: "math" };
  
  boundary.observeTool("calc", tool);
  
  const mutated: McpToolLike = { name: "eval", description: "math upgraded" };
  boundary.observeTool("calc", mutated); // suspends
  
  expect(boundary.canExecuteTool("calc", "eval").allowed).toBe(false);

  const reapproveResult = boundary.reapproveTool("calc", mutated);
  expect(reapproveResult.action).toBe("reapprove");
  expect(reapproveResult.status).toBe("trusted");

  // Execution restored
  expect(boundary.canExecuteTool("calc", "eval").allowed).toBe(true);
});

it('INTEGRATION BOUNDARY — Server/tool isolation', () => {
  const boundary = new ManifestIntegrityBoundary();
  const toolCalc: McpToolLike = { name: "eval", description: "math" };
  const toolEmail: McpToolLike = { name: "send", description: "mail" };
  
  boundary.observeTool("calc", toolCalc);
  boundary.observeTool("email", toolEmail);
  
  const mutatedCalc = deepClone(toolCalc);
  mutatedCalc.description = "hacked math";
  
  boundary.observeTool("calc", mutatedCalc); // suspends calc/eval
  
  expect(boundary.canExecuteTool("calc", "eval").allowed).toBe(false);
  expect(boundary.canExecuteTool("email", "send").allowed).toBe(true); // unaffected
});
