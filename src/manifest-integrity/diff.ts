import type { ManifestDiff } from './types.ts';

/**
 * Computes a structural diff between a baseline object and a current object.
 * Supports nested objects and arrays.
 */
export function diffManifests(baseline: unknown, current: unknown, path = ''): ManifestDiff[] {
  const diffs: ManifestDiff[] = [];

  if (baseline === current) {
    return diffs;
  }

  const isBaselineObject = baseline !== null && typeof baseline === 'object';
  const isCurrentObject = current !== null && typeof current === 'object';

  if (!isBaselineObject || !isCurrentObject) {
    if (baseline === undefined) {
      diffs.push({ path, type: 'added', current });
    } else if (current === undefined) {
      diffs.push({ path, type: 'removed', previous: baseline });
    } else {
      diffs.push({ path, type: 'changed', previous: baseline, current });
    }
    return diffs;
  }

  // Array comparison
  if (Array.isArray(baseline) && Array.isArray(current)) {
    const maxLen = Math.max(baseline.length, current.length);
    for (let i = 0; i < maxLen; i++) {
      const newPath = path ? `${path}[${i}]` : `[${i}]`;
      if (i >= baseline.length) {
        diffs.push({ path: newPath, type: 'added', current: current[i] });
      } else if (i >= current.length) {
        diffs.push({ path: newPath, type: 'removed', previous: baseline[i] });
      } else {
        diffs.push(...diffManifests(baseline[i], current[i], newPath));
      }
    }
    return diffs;
  }

  // Type changed between Array and Object
  if (Array.isArray(baseline) !== Array.isArray(current)) {
    diffs.push({ path, type: 'changed', previous: baseline, current });
    return diffs;
  }

  // Object comparison
  const baselineObj = baseline as Record<string, unknown>;
  const currentObj = current as Record<string, unknown>;
  const allKeys = new Set([...Object.keys(baselineObj), ...Object.keys(currentObj)]);

  for (const key of allKeys) {
    const newPath = path ? `${path}.${key}` : key;
    const hasInBaseline = Object.prototype.hasOwnProperty.call(baselineObj, key);
    const hasInCurrent = Object.prototype.hasOwnProperty.call(currentObj, key);

    if (!hasInBaseline) {
      diffs.push({ path: newPath, type: 'added', current: currentObj[key] });
    } else if (!hasInCurrent) {
      diffs.push({ path: newPath, type: 'removed', previous: baselineObj[key] });
    } else {
      diffs.push(...diffManifests(baselineObj[key], currentObj[key], newPath));
    }
  }

  return diffs;
}
