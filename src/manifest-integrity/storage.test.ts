import test from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import { ManifestIntegrityBoundary } from './boundary.ts';
import type { McpToolLike } from './adapter.ts';

const DB_PATH = './test-persistence.json';

const cleanup = () => {
  if (fs.existsSync(DB_PATH)) fs.unlinkSync(DB_PATH);
  if (fs.existsSync(`${DB_PATH}.tmp`)) fs.unlinkSync(`${DB_PATH}.tmp`);
};

test('PERSISTENCE — empty/nonexistent persistence file initializes safely', () => {
  cleanup();
  const boundary = new ManifestIntegrityBoundary(DB_PATH);
  
  const tool: McpToolLike = { name: "eval", description: "math" };
  const result = boundary.observeTool("calc", tool);
  
  assert.strictEqual(result.action, "pin");
  assert.strictEqual(result.status, "trusted");
  assert.ok(fs.existsSync(DB_PATH));
  cleanup();
});

test('PERSISTENCE — save and reload baseline', () => {
  cleanup();
  const boundary = new ManifestIntegrityBoundary(DB_PATH);
  boundary.observeTool("calc", { name: "eval", description: "math" });

  const boundary2 = new ManifestIntegrityBoundary(DB_PATH);
  assert.strictEqual(boundary2.canExecuteTool("calc", "eval").allowed, true);
  cleanup();
});

test('PERSISTENCE — reload then verify unchanged manifest', () => {
  cleanup();
  new ManifestIntegrityBoundary(DB_PATH).observeTool("calc", { name: "eval", description: "math" });

  const boundary2 = new ManifestIntegrityBoundary(DB_PATH);
  const result = boundary2.observeTool("calc", { name: "eval", description: "math" });
  
  assert.strictEqual(result.action, "verify");
  cleanup();
});

test('PERSISTENCE — reload then detect description mutation', () => {
  cleanup();
  new ManifestIntegrityBoundary(DB_PATH).observeTool("calc", { name: "eval", description: "math" });

  const boundary2 = new ManifestIntegrityBoundary(DB_PATH);
  const result = boundary2.observeTool("calc", { name: "eval", description: "hacked" });
  
  assert.strictEqual(result.action, "suspend");
  assert.strictEqual(boundary2.canExecuteTool("calc", "eval").allowed, false);
  cleanup();
});

test('PERSISTENCE — reload then detect schema mutation', () => {
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
  
  assert.strictEqual(result.action, "suspend");
  cleanup();
});

test('PERSISTENCE — mismatch does not overwrite persisted baseline', () => {
  cleanup();
  new ManifestIntegrityBoundary(DB_PATH).observeTool("calc", { name: "eval", description: "math" });

  const boundary2 = new ManifestIntegrityBoundary(DB_PATH);
  boundary2.observeTool("calc", { name: "eval", description: "hacked" }); // suspends

  // Restart again
  const boundary3 = new ManifestIntegrityBoundary(DB_PATH);
  
  // Should verify the original math tool, because hacked shouldn't overwrite the file
  const result = boundary3.observeTool("calc", { name: "eval", description: "math" });
  assert.strictEqual(result.action, "verify");
  cleanup();
});

test('PERSISTENCE — reapproval replaces persisted baseline', () => {
  cleanup();
  new ManifestIntegrityBoundary(DB_PATH).observeTool("calc", { name: "eval", description: "math" });

  const boundary2 = new ManifestIntegrityBoundary(DB_PATH);
  boundary2.reapproveTool("calc", { name: "eval", description: "upgraded" }); 

  // Restart
  const boundary3 = new ManifestIntegrityBoundary(DB_PATH);
  
  // "math" should now be suspended, "upgraded" should verify
  const resultOld = boundary3.observeTool("calc", { name: "eval", description: "math" });
  assert.strictEqual(resultOld.action, "suspend");

  const resultNew = boundary3.observeTool("calc", { name: "eval", description: "upgraded" });
  assert.strictEqual(resultNew.action, "verify");
  cleanup();
});

test('PERSISTENCE — defensive copy on persistence', () => {
  cleanup();
  const boundary = new ManifestIntegrityBoundary(DB_PATH);
  const tool: McpToolLike = { name: "eval", description: "math" };
  
  boundary.observeTool("calc", tool);
  
  // Malicious pointer mutation
  tool.description = "hacked";
  
  const boundary2 = new ManifestIntegrityBoundary(DB_PATH);
  const result = boundary2.observeTool("calc", { name: "eval", description: "math" });
  
  assert.strictEqual(result.action, "verify");
  cleanup();
});

test('PERSISTENCE — malformed persistence data fails safely', () => {
  cleanup();
  fs.writeFileSync(DB_PATH, '{ bad json ]', 'utf-8');

  assert.throws(() => new ManifestIntegrityBoundary(DB_PATH), /FATAL.*corrupted/);
  cleanup();
});

test('PERSISTENCE — server/tool isolation maintained', () => {
  cleanup();
  const boundary = new ManifestIntegrityBoundary(DB_PATH);
  boundary.observeTool("calc", { name: "eval", description: "math" });
  boundary.observeTool("email", { name: "send", description: "mail" });

  const boundary2 = new ManifestIntegrityBoundary(DB_PATH);
  assert.strictEqual(boundary2.canExecuteTool("calc", "eval").allowed, true);
  assert.strictEqual(boundary2.canExecuteTool("email", "send").allowed, true);
  
  boundary2.observeTool("calc", { name: "eval", description: "hacked" });
  
  // calc is suspended, email is fine
  assert.strictEqual(boundary2.canExecuteTool("calc", "eval").allowed, false);
  assert.strictEqual(boundary2.canExecuteTool("email", "send").allowed, true);
  cleanup();
});
