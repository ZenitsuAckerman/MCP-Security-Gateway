import type { ApprovedBaseline, StoreEntry, IntegrityStatus } from './types.ts';
import type { PersistentStorage } from './storage.ts';

export class BaselineStore {
  private store = new Map<string, StoreEntry>();
  private storage?: PersistentStorage;

  constructor(storage?: PersistentStorage) {
    this.storage = storage;
    if (this.storage) {
      const persisted = this.storage.load();
      for (const key of Object.keys(persisted)) {
        this.store.set(key, {
          baseline: structuredClone(persisted[key]),
          status: 'trusted' // Implicitly trusted upon loading until a verify() occurs
        });
      }
    }
  }

  private getKey(server: string, tool: string): string {
    return `${server}:${tool}`;
  }

  private persist(): void {
    if (!this.storage) return;
    
    const data: Record<string, ApprovedBaseline> = {};
    for (const [key, entry] of this.store.entries()) {
      data[key] = structuredClone(entry.baseline);
    }
    this.storage.save(data);
  }

  getBaseline(server: string, tool: string): ApprovedBaseline | undefined {
    const entry = this.store.get(this.getKey(server, tool));
    return entry ? structuredClone(entry.baseline) : undefined;
  }

  getStatus(server: string, tool: string): IntegrityStatus | undefined {
    const entry = this.store.get(this.getKey(server, tool));
    return entry ? entry.status : undefined;
  }

  set(baseline: ApprovedBaseline, status: IntegrityStatus = 'trusted'): void {
    this.store.set(this.getKey(baseline.server, baseline.tool), {
      baseline: structuredClone(baseline),
      status
    });
    this.persist();
  }

  updateStatus(server: string, tool: string, status: IntegrityStatus): void {
    const entry = this.store.get(this.getKey(server, tool));
    if (entry) {
      entry.status = status;
      // Note: We do NOT persist here because status is ephemeral and operational.
    }
  }

  has(server: string, tool: string): boolean {
    return this.store.has(this.getKey(server, tool));
  }

  clear(): void {
    this.store.clear();
    this.persist();
  }
}
