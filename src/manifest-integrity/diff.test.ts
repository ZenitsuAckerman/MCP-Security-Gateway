import test from 'node:test';
import assert from 'node:assert';
import { diffManifests } from './diff.ts';

test('diffManifests detects additions, removals, and changes', () => {
  const baseline = {
    a: 1,
    b: { c: 2 },
    d: [1, 2]
  };

  const current = {
    a: 2, // changed
    b: { c: 2, e: 3 }, // added e
    d: [1] // removed 2
  };

  const diffs = diffManifests(baseline, current);

  const sortedDiffs = diffs.sort((a, b) => a.path.localeCompare(b.path));
  const expected = [
    { path: 'a', type: 'changed', previous: 1, current: 2 },
    { path: 'b.e', type: 'added', current: 3 },
    { path: 'd[1]', type: 'removed', previous: 2 }
  ].sort((a, b) => a.path.localeCompare(b.path));

  assert.deepStrictEqual(sortedDiffs, expected);
});

test('diffManifests handles empty vs populated', () => {
  const baseline = { a: 1 };
  const current = {};
  
  const diffs = diffManifests(baseline, current);
  assert.deepStrictEqual(diffs, [
    { path: 'a', type: 'removed', previous: 1 }
  ]);
});
