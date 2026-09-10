import type { ManifestIntegrityVerifier } from './verifier.ts';
import type { ExecutionDecision } from './types.ts';

export class ExecutionGate {
  private verifier: ManifestIntegrityVerifier;

  constructor(verifier: ManifestIntegrityVerifier) {
    this.verifier = verifier;
  }

  /**
   * Evaluates if a specific tool from a specific server is allowed to execute.
   * This is a read-only transport-independent boundary.
   */
  canExecute(server: string, tool: string): ExecutionDecision {
    if (!this.verifier.isKnown(server, tool)) {
      return { allowed: false, server, tool, reason: 'unknown' };
    }
    
    if (this.verifier.isSuspended(server, tool)) {
      return { allowed: false, server, tool, reason: 'suspended' };
    }
    
    return { allowed: true, server, tool, reason: 'trusted' };
  }
}
