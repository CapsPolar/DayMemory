import type { StoragePort } from "../ports/StoragePort";

const BUFFER_KEY = "dayMemoryPendingAppends";

/**
 * The "quick add without unlocking" buffer: plain, unencrypted, per-date
 * text kept in storage until the vault is unlocked and it gets merged in
 * (see VaultService.mergeAppends) and cleared.
 */
export class BufferService {
  // Mutations are read-modify-write on one stored record, so they're run
  // strictly one at a time; otherwise two overlapping saves (e.g. for two
  // different dates) could each read the old record and clobber the other.
  private queue: Promise<unknown> = Promise.resolve();

  constructor(private readonly storage: StoragePort) {}

  private enqueue<T>(task: () => Promise<T>): Promise<T> {
    const run = this.queue.then(task, task);
    this.queue = run.catch(() => undefined);
    return run;
  }

  async getAll(): Promise<Record<string, string>> {
    const raw = await this.storage.getItem(BUFFER_KEY);
    if (!raw) return {};
    try {
      const parsed: unknown = JSON.parse(raw);
      return typeof parsed === "object" && parsed !== null
        ? (parsed as Record<string, string>)
        : {};
    } catch {
      return {};
    }
  }

  async getEntry(dateKey: string): Promise<string> {
    return (await this.getAll())[dateKey] || "";
  }

  saveEntry(dateKey: string, text: string): Promise<void> {
    return this.enqueue(async () => {
      const buffer = await this.getAll();
      buffer[dateKey] = text;
      await this.storage.setItem(BUFFER_KEY, JSON.stringify(buffer));
    });
  }

  deleteEntry(dateKey: string): Promise<void> {
    return this.enqueue(async () => {
      const buffer = await this.getAll();
      delete buffer[dateKey];
      await this.storage.setItem(BUFFER_KEY, JSON.stringify(buffer));
    });
  }

  /** Wipes the whole buffer (called after a successful merge into the vault). */
  clear(): Promise<void> {
    return this.enqueue(() => this.storage.removeItem(BUFFER_KEY));
  }
}
