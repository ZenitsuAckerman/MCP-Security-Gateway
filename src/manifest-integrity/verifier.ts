import { hashManifest } from './hash.ts';
import { diffManifests } from './diff.ts';
import type { BaselineStore } from './store.ts';
import type { ToolManifest, IntegrityResult, ApprovedBaseline } from './types.ts';

export class ManifestIntegrityVerifier {
  private store: BaselineStore;

  constructor(store: BaselineStore) {
    this.store = store;
  }

  verify(manifest: ToolManifest): IntegrityResult {
    const currentHash = hashManifest(manifest);
    const baseline = this.store.getBaseline(manifest.server, manifest.tool);

    if (!baseline) {
      const newBaseline: ApprovedBaseline = {
        server: manifest.server,
        tool: manifest.tool,
        hash: currentHash,
        approvedAt: new Date().toISOString(),
        originalManifest: structuredClone(manifest)
      };
      this.store.set(newBaseline, 'trusted');

      return {
        server: manifest.server,
        tool: manifest.tool,
        status: 'trusted',
        action: 'pin',
        currentHash
      };
    }

    if (baseline.hash === currentHash) {
      // Clear any previous suspension since the tool returned to its approved state
      this.store.updateStatus(manifest.server, manifest.tool, 'trusted');
      
      return {
        server: manifest.server,
        tool: manifest.tool,
        status: 'trusted',
        action: 'verify',
        currentHash,
        baselineHash: baseline.hash
      };
    }

    // Hash mismatch means the tool has drifted from its baseline
    this.store.updateStatus(manifest.server, manifest.tool, 'suspended');
    
    const diff = diffManifests(baseline.originalManifest, manifest);
    return {
      server: manifest.server,
      tool: manifest.tool,
      status: 'suspended',
      action: 'suspend',
      currentHash,
      baselineHash: baseline.hash,
      diff
    };
  }

  reapprove(manifest: ToolManifest): IntegrityResult {
    const currentHash = hashManifest(manifest);
    const hasExisting = this.store.has(manifest.server, manifest.tool);

    const newBaseline: ApprovedBaseline = {
      server: manifest.server,
      tool: manifest.tool,
      hash: currentHash,
      approvedAt: new Date().toISOString(),
      originalManifest: structuredClone(manifest)
    };
    
    this.store.set(newBaseline, 'trusted');

    return {
      server: manifest.server,
      tool: manifest.tool,
      status: 'trusted',
      action: hasExisting ? 'reapprove' : 'pin',
      currentHash
    };
  }

  isSuspended(server: string, tool: string): boolean {
    return this.store.getStatus(server, tool) === 'suspended';
  }

  isKnown(server: string, tool: string): boolean {
    return this.store.has(server, tool);
  }
}
