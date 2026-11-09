import type { StoragePort } from "@core/ports/StoragePort";

const DB_NAME = "DayMemoryDB";
const DB_VERSION = 1;
const STORE_NAME = "keyval";

/**
 * StoragePort implementation backed by IndexedDB: one object store used as
 * a simple string key/value table.
 *
 * Writes resolve on the transaction's `complete` event (not just request
 * success), i.e. only once the data is durably committed.
 */
export class IndexedDBAdapter implements StoragePort {
  private dbPromise: Promise<IDBDatabase> | null = null;

  /** Opens (and, on first run, creates) the database. Safe to call repeatedly. */
  open(): Promise<IDBDatabase> {
    if (this.dbPromise) return this.dbPromise;

    this.dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
      if (typeof indexedDB === "undefined") {
        reject(new Error("IndexedDB is not available in this browser."));
        return;
      }
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME);
        }
      };
      request.onsuccess = () => {
        const db = request.result;
        // If another tab upgrades/deletes the DB, release our connection.
        db.onversionchange = () => {
          db.close();
          this.dbPromise = null;
        };
        resolve(db);
      };
      request.onerror = () =>
        reject(request.error ?? new Error("Failed to open IndexedDB."));
      request.onblocked = () =>
        reject(new Error("IndexedDB open was blocked by another tab."));
    });

    // Don't cache a failed open — let the next call retry.
    this.dbPromise.catch(() => {
      this.dbPromise = null;
    });
    return this.dbPromise;
  }

  async getItem(key: string): Promise<string | null> {
    const db = await this.open();
    return new Promise<string | null>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readonly");
      const req = tx.objectStore(STORE_NAME).get(key);
      req.onsuccess = () => {
        const value = req.result;
        resolve(typeof value === "string" ? value : null);
      };
      req.onerror = () => reject(req.error);
      tx.onabort = () => reject(tx.error);
    });
  }

  async setItem(key: string, value: string): Promise<void> {
    const db = await this.open();
    return new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      tx.objectStore(STORE_NAME).put(value, key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error ?? new Error("IndexedDB write aborted."));
    });
  }

  async removeItem(key: string): Promise<void> {
    const db = await this.open();
    return new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      tx.objectStore(STORE_NAME).delete(key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error ?? new Error("IndexedDB delete aborted."));
    });
  }
}
