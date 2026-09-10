import test from 'node:test';
import assert from 'node:assert';
import { BaselineStore } from './store.ts';
import { ManifestIntegrityVerifier } from './verifier.ts';
import type { ToolManifest } from './types.ts';

const deepClone = <T>(obj: T): T => JSON.parse(JSON.stringify(obj));

const createManifest = (server: string, tool: string, desc = 'desc'): ToolManifest => ({
  server,
  tool,
  name: tool,
  description: desc,
  inputSchema: { type: 'object', properties: { a: { type: 'string' } } }
});

test('TEST A — First observation pins', () => {
  const store = new BaselineStore();
  const verifier = new ManifestIntegrityVerifier(store);
  const manifest = createManifest('s1', 't1');

  const result = verifier.verify(manifest);
  assert.strictEqual(result.status, 'trusted');
  assert.strictEqual(result.action, 'pin');
  assert.ok(store.has('s1', 't1'));
});

test('TEST B — Same manifest verifies', () => {
  const store = new BaselineStore();
  const verifier = new ManifestIntegrityVerifier(store);
  const manifest = createManifest('s1', 't1');

  verifier.verify(manifest); // pins
  const result = verifier.verify(deepClone(manifest)); // verifies
  
  assert.strictEqual(result.status, 'trusted');
  assert.strictEqual(result.action, 'verify');
});

test('TEST C — Key reordering does NOT trigger suspension', () => {
  const store = new BaselineStore();
  const verifier = new ManifestIntegrityVerifier(store);
  const manifestA = createManifest('s1', 't1');
  
  verifier.verify(manifestA); // pins

  const manifestB: ToolManifest = {
    name: 't1',
    description: 'desc',
    tool: 't1',
    server: 's1',
    inputSchema: { properties: { a: { type: 'string' } }, type: 'object' }
  };

  const result = verifier.verify(manifestB);
  assert.strictEqual(result.status, 'trusted');
  assert.strictEqual(result.action, 'verify');
});

test('TEST D — Description mutation suspends', () => {
  const store = new BaselineStore();
  const verifier = new ManifestIntegrityVerifier(store);
  const manifest = createManifest('s1', 't1');
  
  verifier.verify(manifest);

  const mutated = deepClone(manifest);
  mutated.description = 'hacked';

  const result = verifier.verify(mutated);
  assert.strictEqual(result.status, 'suspended');
  assert.strictEqual(result.action, 'suspend');
  
  assert.deepStrictEqual(result.diff, [
    { path: 'description', type: 'changed', previous: 'desc', current: 'hacked' }
  ]);
});

test('TEST E — Schema mutation suspends', () => {
  const store = new BaselineStore();
  const verifier = new ManifestIntegrityVerifier(store);
  const manifest = createManifest('s1', 't1');
  
  verifier.verify(manifest);

  const mutated = deepClone(manifest);
  (mutated.inputSchema as any).properties.a.type = 'number';

  const result = verifier.verify(mutated);
  assert.strictEqual(result.status, 'suspended');
  assert.strictEqual(result.action, 'suspend');
  assert.deepStrictEqual(result.diff, [
    { path: 'inputSchema.properties.a.type', type: 'changed', previous: 'string', current: 'number' }
  ]);
});

test('TEST F — Baseline is NOT overwritten after mutation', () => {
  const store = new BaselineStore();
  const verifier = new ManifestIntegrityVerifier(store);
  const manifest = createManifest('s1', 't1');
  
  verifier.verify(manifest);

  const mutated = deepClone(manifest);
  mutated.description = 'hacked';

  verifier.verify(mutated); // suspends

  const result = verifier.verify(manifest); // verify original again
  assert.strictEqual(result.status, 'trusted');
  assert.strictEqual(result.action, 'verify');
});

test('TEST G — Reapproval replaces baseline', () => {
  const store = new BaselineStore();
  const verifier = new ManifestIntegrityVerifier(store);
  const manifest1 = createManifest('s1', 't1', 'v1');
  const manifest2 = createManifest('s1', 't1', 'v2');
  
  verifier.verify(manifest1); // pins v1
  
  const reapproveResult = verifier.reapprove(manifest2); // reapproves v2
  assert.strictEqual(reapproveResult.status, 'trusted');
  assert.strictEqual(reapproveResult.action, 'reapprove');

  const result2 = verifier.verify(manifest2);
  assert.strictEqual(result2.status, 'trusted');
  assert.strictEqual(result2.action, 'verify'); // v2 verifies

  const result1 = verifier.verify(manifest1);
  assert.strictEqual(result1.status, 'suspended');
  assert.strictEqual(result1.action, 'suspend'); // v1 now suspends
});

test('TEST H — Reapproval updates timestamp', () => {
  const store = new BaselineStore();
  const verifier = new ManifestIntegrityVerifier(store);
  const manifest1 = createManifest('s1', 't1', 'v1');
  const manifest2 = createManifest('s1', 't1', 'v2');
  
  verifier.verify(manifest1);
  const t1 = store.getBaseline('s1', 't1')!.approvedAt;
  
  // Force a tiny delay so timestamp definitely advances
  const start = Date.now();
  while (Date.now() - start < 5) {}

  verifier.reapprove(manifest2);
  const t2 = store.getBaseline('s1', 't1')!.approvedAt;
  
  assert.notStrictEqual(t1, t2);
});

test('TEST I — Multiple servers/tools remain isolated', () => {
  const store = new BaselineStore();
  const verifier = new ManifestIntegrityVerifier(store);
  const manifestCalc = createManifest('calculator', 'evaluate');
  const manifestEmail = createManifest('email', 'send');
  
  verifier.verify(manifestCalc);
  verifier.verify(manifestEmail);

  const mutatedCalc = deepClone(manifestCalc);
  mutatedCalc.description = 'hacked';

  const resCalc = verifier.verify(mutatedCalc);
  assert.strictEqual(resCalc.status, 'suspended');

  const resEmail = verifier.verify(manifestEmail);
  assert.strictEqual(resEmail.status, 'trusted');
});

test('TEST J — Defensive baseline copying', () => {
  const store = new BaselineStore();
  const verifier = new ManifestIntegrityVerifier(store);
  const manifest = createManifest('s1', 't1');
  
  verifier.verify(manifest);
  
  // Mutate original object
  manifest.description = 'hacked';
  
  // Baseline should be unchanged
  assert.strictEqual(store.getBaseline('s1', 't1')!.originalManifest.description, 'desc');

  // Mutate retrieved object
  const retrieved = store.getBaseline('s1', 't1')!;
  retrieved.originalManifest.description = 'hacked again';

  // Baseline should still be unchanged
  assert.strictEqual(store.getBaseline('s1', 't1')!.originalManifest.description, 'desc');
});

test('TEST K — Invalid manifest does not corrupt baseline', () => {
  const store = new BaselineStore();
  const verifier = new ManifestIntegrityVerifier(store);
  const manifest = createManifest('s1', 't1');
  
  verifier.verify(manifest);

  const badManifest = deepClone(manifest);
  (badManifest as any).bad = undefined;

  assert.throws(() => verifier.verify(badManifest), TypeError);
  assert.throws(() => verifier.reapprove(badManifest), TypeError);

  // Original is still valid and unchanged
  const result = verifier.verify(manifest);
  assert.strictEqual(result.status, 'trusted');
});
