import type { StoragePort } from "../ports/StoragePort";

const BUFFER_KEY = "dayMemoryPendingAppends";

/**
 * The "quick add without unlocking" buffer: plain, unencrypted string
 * kept in storage until the vault is unlocked and merged in[cite: 7].
 */
export class BufferService {
  private queue: Promise<unknown> = Promise.resolve();

  constructor(private readonly storage: StoragePort) {}

  private enqueue<T>(task: () => Promise<T>): Promise<T> {
    const run = this.queue.then(task, task);
    this.queue = run.catch(() => undefined);
    return run;
  }

  async getBuffer(): Promise<string> {
    return (await this.storage.getItem(BUFFER_KEY)) || "";
  }

  saveBuffer(text: string): Promise<void> {
    return this.enqueue(async () => {
      await this.storage.setItem(BUFFER_KEY, text);
    });
  }

  clear(): Promise<void> {
    return this.enqueue(() => this.storage.removeItem(BUFFER_KEY));
  }
}