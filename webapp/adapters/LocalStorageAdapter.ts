import type { StoragePort } from "@core/ports/StoragePort";

/** StoragePort implementation backed by the browser's window.localStorage. */
export class LocalStorageAdapter implements StoragePort {
  getItem(key: string): string | null {
    return localStorage.getItem(key);
  }
  setItem(key: string, value: string): void {
    localStorage.setItem(key, value);
  }
  removeItem(key: string): void {
    localStorage.removeItem(key);
  }
}
