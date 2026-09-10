import fs from 'node:fs';
import type { ApprovedBaseline } from './types.ts';

/**
 * Persistence layer abstraction for the manifest integrity subsystem.
 * Responsible strictly for storing and loading ApprovedBaseline records.
 */
export interface PersistentStorage {
  load(): Record<string, ApprovedBaseline>;
  save(data: Record<string, ApprovedBaseline>): void;
}

/**
 * A transport-independent JSON file implementation of the PersistentStorage layer.
 * Enforces atomic writes and fails closed upon encountering corrupted baseline files.
 */
export class JsonFileStorage implements PersistentStorage {
  private filePath: string;

  constructor(filePath: string) {
    this.filePath = filePath;
  }

  load(): Record<string, ApprovedBaseline> {
    if (!fs.existsSync(this.filePath)) {
      // First-ever initialization at this path
      return {};
    }

    const raw = fs.readFileSync(this.filePath, 'utf-8');
    try {
      return JSON.parse(raw);
    } catch (err) {
      // Throw a fatal error on malformed data rather than silently
      // pretending the registry is empty, to prevent auto-pinning attacks.
      throw new Error(`FATAL: Persistence file at ${this.filePath} is corrupted. Refusing to start.`);
    }
  }

  save(data: Record<string, ApprovedBaseline>): void {
    const tmpPath = `${this.filePath}.tmp`;
    
    // Write atomically: write to temp file then rename
    fs.writeFileSync(tmpPath, JSON.stringify(data, null, 2), 'utf-8');
    fs.renameSync(tmpPath, this.filePath);
  }
}
