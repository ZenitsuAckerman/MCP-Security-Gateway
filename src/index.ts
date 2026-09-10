export * from './types';
import { DecisionEngine } from './engine/DecisionEngine';
export { DecisionEngine, SecurityEventListener } from './engine/DecisionEngine';
export { ContentSecurityAdapter, MCPToolManifest, MCPToolResult } from './adapter/ContentSecurityAdapter';

/**
 * Global Sentinel singleton instance using safe default configuration.
 * For isolated testing or multi-tenant proxies, instantiate `new DecisionEngine(config)` directly.
 */
export const Sentinel = new DecisionEngine();
