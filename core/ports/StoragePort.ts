/**
 * Port the core depends on for durable key/value persistence.
 * The webapp connects this to an adapter (e.g. LocalStorageAdapter) that
 * is compatible with this interface — the core never talks to
 * localStorage, or any browser API, directly.
 */
export interface StoragePort {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}
