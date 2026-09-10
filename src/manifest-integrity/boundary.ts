import { BaselineStore } from './store.ts';
import { ManifestIntegrityVerifier } from './verifier.ts';
import { ExecutionGate } from './gate.ts';
import { toToolManifest, type McpToolLike } from './adapter.ts';
import { JsonFileStorage } from './storage.ts';
import type { IntegrityResult, ExecutionDecision } from './types.ts';

/**
 * Transport-independent integration boundary for the Sentinel Proxy.
 * Provides the explicit API for tools/list and tools/call interception.
 */
export class ManifestIntegrityBoundary {
  private store: BaselineStore;
  private verifier: ManifestIntegrityVerifier;
  private gate: ExecutionGate;

  /**
   * Initializes the integrity boundary.
   * @param persistenceFilePath Optional path to a JSON file. If provided, the system
   * will persist approved baselines automatically to survive process restarts.
   * If omitted, runs in ephemeral memory mode.
   */
  constructor(persistenceFilePath?: string) {
    const storage = persistenceFilePath ? new JsonFileStorage(persistenceFilePath) : undefined;
    this.store = new BaselineStore(storage);
    this.verifier = new ManifestIntegrityVerifier(this.store);
    this.gate = new ExecutionGate(this.verifier);
  }

  /**
   * tools/list Interception
   * 
   * Maps a raw MCP tool into a strictly typed ToolManifest, 
   * canonicalizes it, hashes it, and verifies it against the trusted baseline.
   * 
   * @param server The explicitly routed server identity
   * @param tool The raw tool object provided by the MCP server
   * @returns IntegrityResult containing status, action (pin/verify/suspend), and diffs
   */
  observeTool(server: string, tool: McpToolLike): IntegrityResult {
    const manifest = toToolManifest(server, tool);
    return this.verifier.verify(manifest);
  }

  /**
   * tools/call Interception
   * 
   * Determines if a specific tool from a specific server is allowed to execute.
   * This is a read-only check against the current integrity state.
   * 
   * @param server The explicitly routed server identity
   * @param toolName The name of the tool requested by the client
   * @returns ExecutionDecision (allowed: boolean, reason: string)
   */
  canExecuteTool(server: string, toolName: string): ExecutionDecision {
    return this.gate.canExecute(server, toolName);
  }

  /**
   * Dashboard / Management Interception
   * 
   * Explicitly reapproves a tool manifest, bypassing any current suspension 
   * and establishing a new trusted baseline.
   * 
   * @param server The server identity
   * @param tool The raw tool object being approved
   * @returns IntegrityResult showing the reapproval action
   */
  reapproveTool(server: string, tool: McpToolLike): IntegrityResult {
    const manifest = toToolManifest(server, tool);
    return this.verifier.reapprove(manifest);
  }
}
