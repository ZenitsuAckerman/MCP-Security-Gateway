

import fs from 'node:fs';
import { ManifestIntegrityBoundary } from './boundary.ts';
import type { McpToolLike } from './adapter.ts';

const DB_PATH = './test-persistence.json';

const cleanup = () => {
  if (fs.existsSync(DB_PATH)) fs.unlinkSync(DB_PATH);
  if (fs.existsSync(`${DB_PATH}.tmp`)) fs.unlinkSync(`${DB_PATH}.tmp`);
};

it('PERSISTENCE — empty/nonexistent persistence file initializes safely', () => {
  cleanup();
  const boundary = new ManifestIntegrityBoundary(DB_PATH);
  
  const tool: McpToolLike = { name: "eval", description: "math" };
  const result = boundary.observeTool("calc", tool);
  
  expect(result.action).toBe("pin");
  expect(result.status).toBe("trusted");
  expect(fs.existsSync(DB_PATH)).toBeTruthy();
  cleanup();
});

it('PERSISTENCE — save and reload baseline', () => {
  cleanup();
  const boundary = new ManifestIntegrityBoundary(DB_PATH);
  boundary.observeTool("calc", { name: "eval", description: "math" });

  const boundary2 = new ManifestIntegrityBoundary(DB_PATH);
  expect(boundary2.canExecuteTool("calc", "eval").allowed).toBe(true);
  cleanup();
});

it('PERSISTENCE — reload then verify unchanged manifest', () => {
  cleanup();
  new ManifestIntegrityBoundary(DB_PATH).observeTool("calc", { name: "eval", description: "math" });

  const boundary2 = new ManifestIntegrityBoundary(DB_PATH);
  const result = boundary2.observeTool("calc", { name: "eval", description: "math" });
  
  expect(result.action).toBe("verify");
  cleanup();
});

it('PERSISTENCE — reload then detect description mutation', () => {
  cleanup();
  new ManifestIntegrityBoundary(DB_PATH).observeTool("calc", { name: "eval", description: "math" });

  const boundary2 = new ManifestIntegrityBoundary(DB_PATH);
  const result = boundary2.observeTool("calc", { name: "eval", description: "hacked" });
  
  expect(result.action).toBe("suspend");
  expect(boundary2.canExecuteTool("calc", "eval").allowed).toBe(false);
  cleanup();
});

it('PERSISTENCE — reload then detect schema mutation', () => {
  cleanup();
  new ManifestIntegrityBoundary(DB_PATH).observeTool("calc", { 
    name: "eval", 
    inputSchema: { type: "object" } 
  });

  const boundary2 = new ManifestIntegrityBoundary(DB_PATH);
  const result = boundary2.observeTool("calc", { 
    name: "eval", 
    inputSchema: { type: "string" } 
  });
  
  expect(result.action).toBe("suspend");
  cleanup();
});

it('PERSISTENCE — mismatch does not overwrite persisted baseline', () => {
  cleanup();
  new ManifestIntegrityBoundary(DB_PATH).observeTool("calc", { name: "eval", description: "math" });

  const boundary2 = new ManifestIntegrityBoundary(DB_PATH);
  boundary2.observeTool("calc", { name: "eval", description: "hacked" }); // suspends

  // Restart again
  const boundary3 = new ManifestIntegrityBoundary(DB_PATH);
  
  // Should verify the original math tool, because hacked shouldn't overwrite the file
  const result = boundary3.observeTool("calc", { name: "eval", description: "math" });
  expect(result.action).toBe("verify");
  cleanup();
});

it('PERSISTENCE — reapproval replaces persisted baseline', () => {
  cleanup();
  new ManifestIntegrityBoundary(DB_PATH).observeTool("calc", { name: "eval", description: "math" });

  const boundary2 = new ManifestIntegrityBoundary(DB_PATH);
  boundary2.reapproveTool("calc", { name: "eval", description: "upgraded" }); 

  // Restart
  const boundary3 = new ManifestIntegrityBoundary(DB_PATH);
  
  // "math" should now be suspended, "upgraded" should verify
  const resultOld = boundary3.observeTool("calc", { name: "eval", description: "math" });
  expect(resultOld.action).toBe("suspend");

  const resultNew = boundary3.observeTool("calc", { name: "eval", description: "upgraded" });
  expect(resultNew.action).toBe("verify");
  cleanup();
});

it('PERSISTENCE — defensive copy on persistence', () => {
  cleanup();
  const boundary = new ManifestIntegrityBoundary(DB_PATH);
  const tool: McpToolLike = { name: "eval", description: "math" };
  
  boundary.observeTool("calc", tool);
  
  // Malicious pointer mutation
  tool.description = "hacked";
  
  const boundary2 = new ManifestIntegrityBoundary(DB_PATH);
  const result = boundary2.observeTool("calc", { name: "eval", description: "math" });
  
  expect(result.action).toBe("verify");
  cleanup();
});

it('PERSISTENCE — malformed persistence data fails safely', () => {
  cleanup();
  fs.writeFileSync(DB_PATH, '{ bad json ]', 'utf-8');

  expect(() => new ManifestIntegrityBoundary(DB_PATH)).toThrow(/FATAL.*corrupted/);
  cleanup();
});

it('PERSISTENCE — server/tool isolation maintained', () => {
  cleanup();
  const boundary = new ManifestIntegrityBoundary(DB_PATH);
  boundary.observeTool("calc", { name: "eval", description: "math" });
  boundary.observeTool("email", { name: "send", description: "mail" });

  const boundary2 = new ManifestIntegrityBoundary(DB_PATH);
  expect(boundary2.canExecuteTool("calc", "eval").allowed).toBe(true);
  expect(boundary2.canExecuteTool("email", "send").allowed).toBe(true);
  
  boundary2.observeTool("calc", { name: "eval", description: "hacked" });
  
  // calc is suspended, email is fine
  expect(boundary2.canExecuteTool("calc", "eval").allowed).toBe(false);
  expect(boundary2.canExecuteTool("email", "send").allowed).toBe(true);
  cleanup();
});
