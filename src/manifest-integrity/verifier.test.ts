

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

it('TEST A — First observation pins', () => {
  const store = new BaselineStore();
  const verifier = new ManifestIntegrityVerifier(store);
  const manifest = createManifest('s1', 't1');

  const result = verifier.verify(manifest);
  expect(result.status).toBe('trusted');
  expect(result.action).toBe('pin');
  expect(store.has('s1', 't1')).toBeTruthy();
});

it('TEST B — Same manifest verifies', () => {
  const store = new BaselineStore();
  const verifier = new ManifestIntegrityVerifier(store);
  const manifest = createManifest('s1', 't1');

  verifier.verify(manifest); // pins
  const result = verifier.verify(deepClone(manifest)); // verifies
  
  expect(result.status).toBe('trusted');
  expect(result.action).toBe('verify');
});

it('TEST C — Key reordering does NOT trigger suspension', () => {
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
  expect(result.status).toBe('trusted');
  expect(result.action).toBe('verify');
});

it('TEST D — Description mutation suspends', () => {
  const store = new BaselineStore();
  const verifier = new ManifestIntegrityVerifier(store);
  const manifest = createManifest('s1', 't1');
  
  verifier.verify(manifest);

  const mutated = deepClone(manifest);
  mutated.description = 'hacked';

  const result = verifier.verify(mutated);
  expect(result.status).toBe('suspended');
  expect(result.action).toBe('suspend');
  
  expect(result.diff).toEqual([
    { path: 'description', type: 'changed', previous: 'desc', current: 'hacked' }
  ]);
});

it('TEST E — Schema mutation suspends', () => {
  const store = new BaselineStore();
  const verifier = new ManifestIntegrityVerifier(store);
  const manifest = createManifest('s1', 't1');
  
  verifier.verify(manifest);

  const mutated = deepClone(manifest);
  (mutated.inputSchema as any).properties.a.type = 'number';

  const result = verifier.verify(mutated);
  expect(result.status).toBe('suspended');
  expect(result.action).toBe('suspend');
  expect(result.diff).toEqual([
    { path: 'inputSchema.properties.a.type', type: 'changed', previous: 'string', current: 'number' }
  ]);
});

it('TEST F — Baseline is NOT overwritten after mutation', () => {
  const store = new BaselineStore();
  const verifier = new ManifestIntegrityVerifier(store);
  const manifest = createManifest('s1', 't1');
  
  verifier.verify(manifest);

  const mutated = deepClone(manifest);
  mutated.description = 'hacked';

  verifier.verify(mutated); // suspends

  const result = verifier.verify(manifest); // verify original again
  expect(result.status).toBe('trusted');
  expect(result.action).toBe('verify');
});

it('TEST G — Reapproval replaces baseline', () => {
  const store = new BaselineStore();
  const verifier = new ManifestIntegrityVerifier(store);
  const manifest1 = createManifest('s1', 't1', 'v1');
  const manifest2 = createManifest('s1', 't1', 'v2');
  
  verifier.verify(manifest1); // pins v1
  
  const reapproveResult = verifier.reapprove(manifest2); // reapproves v2
  expect(reapproveResult.status).toBe('trusted');
  expect(reapproveResult.action).toBe('reapprove');

  const result2 = verifier.verify(manifest2);
  expect(result2.status).toBe('trusted');
  expect(result2.action).toBe('verify'); // v2 verifies

  const result1 = verifier.verify(manifest1);
  expect(result1.status).toBe('suspended');
  expect(result1.action).toBe('suspend'); // v1 now suspends
});

it('TEST H — Reapproval updates timestamp', () => {
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
  
  expect(t1).not.toBe(t2);
});

it('TEST I — Multiple servers/tools remain isolated', () => {
  const store = new BaselineStore();
  const verifier = new ManifestIntegrityVerifier(store);
  const manifestCalc = createManifest('calculator', 'evaluate');
  const manifestEmail = createManifest('email', 'send');
  
  verifier.verify(manifestCalc);
  verifier.verify(manifestEmail);

  const mutatedCalc = deepClone(manifestCalc);
  mutatedCalc.description = 'hacked';

  const resCalc = verifier.verify(mutatedCalc);
  expect(resCalc.status).toBe('suspended');

  const resEmail = verifier.verify(manifestEmail);
  expect(resEmail.status).toBe('trusted');
});

it('TEST J — Defensive baseline copying', () => {
  const store = new BaselineStore();
  const verifier = new ManifestIntegrityVerifier(store);
  const manifest = createManifest('s1', 't1');
  
  verifier.verify(manifest);
  
  // Mutate original object
  manifest.description = 'hacked';
  
  // Baseline should be unchanged
  expect(store.getBaseline('s1', 't1')!.originalManifest.description).toBe('desc');

  // Mutate retrieved object
  const retrieved = store.getBaseline('s1', 't1')!;
  retrieved.originalManifest.description = 'hacked again';

  // Baseline should still be unchanged
  expect(store.getBaseline('s1', 't1')!.originalManifest.description).toBe('desc');
});

it('TEST K — Invalid manifest does not corrupt baseline', () => {
  const store = new BaselineStore();
  const verifier = new ManifestIntegrityVerifier(store);
  const manifest = createManifest('s1', 't1');
  
  verifier.verify(manifest);

  const badManifest = deepClone(manifest);
  (badManifest as any).bad = undefined;

  expect(() => verifier.verify(badManifest)).toThrow(TypeError);
  expect(() => verifier.reapprove(badManifest)).toThrow(TypeError);

  // Original is still valid and unchanged
  const result = verifier.verify(manifest);
  expect(result.status).toBe('trusted');
});
