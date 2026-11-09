/**
 * Port the core depends on for durable key/value persistence.
 * The webapp connects this to an adapter (e.g. IndexedDBAdapter) that is
 * compatible with this interface — the core never talks to IndexedDB,
 * localStorage, or any browser API directly.
 *
 * Everything is async because the real backing store (IndexedDB) is. A
 * promise resolves only once the write is durably committed, so callers
 * can safely `await` a write before doing something irreversible (like
 * clearing the quick-add buffer after merging it into the vault).
 */
export interface StoragePort {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
}
