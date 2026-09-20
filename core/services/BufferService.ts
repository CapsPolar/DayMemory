import type { StoragePort } from "../ports/StoragePort";

const BUFFER_KEY = "dayMemoryPendingAppends";

/**
 * The "quick add without unlocking" buffer: plain, unencrypted, per-date
 * text kept in storage until the vault is unlocked and it gets merged in
 * (see VaultService.mergeAppends) and cleared.
 */
export class BufferService {
  constructor(private readonly storage: StoragePort) {}

  getAll(): Record<string, string> {
    const raw = this.storage.getItem(BUFFER_KEY);
    return raw ? JSON.parse(raw) : {};
  }

  getEntry(dateKey: string): string {
    return this.getAll()[dateKey] || "";
  }

  saveEntry(dateKey: string, text: string): void {
    const buffer = this.getAll();
    buffer[dateKey] = text;
    this.storage.setItem(BUFFER_KEY, JSON.stringify(buffer));
  }

  deleteEntry(dateKey: string): void {
    const buffer = this.getAll();
    delete buffer[dateKey];
    this.storage.setItem(BUFFER_KEY, JSON.stringify(buffer));
  }

  /** Wipes the whole buffer (called after a successful merge into the vault). */
  clear(): void {
    this.storage.removeItem(BUFFER_KEY);
  }
}
