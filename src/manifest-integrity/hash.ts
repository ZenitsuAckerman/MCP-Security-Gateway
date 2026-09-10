import { createHash } from 'node:crypto';
import type { ToolManifest } from './types.ts';

/**
 * Recursively orders keys of an object to ensure deterministic JSON serialization.
 */
export function canonicalize(obj: unknown): unknown {
  if (typeof obj === 'undefined') {
    throw new TypeError('Unsupported value: undefined');
  }
  if (typeof obj === 'function') {
    throw new TypeError('Unsupported value: function');
  }
  if (typeof obj === 'symbol') {
    throw new TypeError('Unsupported value: symbol');
  }
  if (typeof obj === 'bigint') {
    throw new TypeError('Unsupported value: bigint');
  }

  if (typeof obj === 'number') {
    if (Number.isNaN(obj) || !Number.isFinite(obj)) {
      throw new TypeError('Unsupported value: NaN or Infinity');
    }
    return obj;
  }

  if (obj === null || typeof obj === 'string' || typeof obj === 'boolean') {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map(canonicalize);
  }

  if (typeof obj === 'object') {
    const toString = Object.prototype.toString.call(obj);
    if (toString !== '[object Object]') {
      throw new TypeError(`Unsupported object type: ${toString}`);
    }
    
    const sortedKeys = Object.keys(obj).sort();
    const result: Record<string, unknown> = {};
    
    for (const key of sortedKeys) {
      const val = (obj as Record<string, unknown>)[key];
      result[key] = canonicalize(val);
    }
    
    return result;
  }

  throw new TypeError(`Unsupported value type: ${typeof obj}`);
}

/**
 * Returns a SHA-256 fingerprint for the deterministically serialized tool manifest.
 */
export function hashManifest(manifest: ToolManifest): string {
  const canonicalString = JSON.stringify(canonicalize(manifest));
  return createHash('sha256').update(canonicalString).digest('hex');
}
