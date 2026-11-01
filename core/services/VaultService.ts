import type { StoragePort } from "../ports/StoragePort";
import type { EncryptionPort } from "../ports/EncryptionPort";
import { formatReadableDate } from "../utils/date";

export interface MemoryEntry {
  id: string;
  text: string;
  readableDate: string;
}

export type Timeline = MemoryEntry[];

export const VAULT_FORMAT_VERSION = 3; // Bump version to drop agents/insights schema

export interface VaultData {
  version: number;
  timeline: Timeline;
}

const VAULT_KEY = "dayMemoryVault";

/**
 * Owns the decrypted, in-memory timeline and all read/write operations.
 * Completely stripped of AI agents and network dependencies.
 */
export class VaultService {
  private timeline: Timeline = [];
  private sessionKey: string | null = null;

  private dirty = false;
  private flushing: Promise<void> | null = null;

  constructor(
    private readonly storage: StoragePort,
    private readonly encryption: EncryptionPort
  ) {}

  get isUnlocked(): boolean {
    return this.sessionKey !== null;
  }

  async hasVault(): Promise<boolean> {
    return (await this.storage.getItem(VAULT_KEY)) !== null;
  }

  async unlock(password: string): Promise<boolean> {
    const encrypted = await this.storage.getItem(VAULT_KEY);

    let data: VaultData;
    if (!encrypted) {
      data = { version: VAULT_FORMAT_VERSION, timeline: [] };
    } else {
      const decrypted = this.encryption.decrypt(encrypted, password);
      if (decrypted === null) return false;

      let parsed: unknown;
      try {
        parsed = JSON.parse(decrypted);
      } catch {
        return false;
      }
      
      if (typeof parsed !== "object" || parsed === null) return false;
      const obj = parsed as Record<string, unknown>;
      
      // Basic validation for timeline structure
      if (!Array.isArray(obj.timeline)) return false;
      data = { version: VAULT_FORMAT_VERSION, timeline: obj.timeline as Timeline };
    }

    this.timeline = data.timeline;
    this.sessionKey = password;
    return true;
  }

  lock(): void {
    this.sessionKey = null;
    this.timeline = [];
    this.dirty = false;
  }

  getTimeline(): Timeline {
    return [...this.timeline].sort((a, b) => b.id.localeCompare(a.id));
  }

  getEntry(dateKey: string): MemoryEntry | undefined {
    return this.timeline.find((e: MemoryEntry) => e.id === dateKey);
  }

  saveEntry(dateKey: string, text: string): Promise<void> {
    const existing = this.timeline.find((e: MemoryEntry) => e.id === dateKey);
    if (existing) {
      existing.text = text;
    } else {
      this.timeline.push({
        id: dateKey,
        text,
        readableDate: formatReadableDate(dateKey),
      });
    }
    return this.persist();
  }

  deleteEntry(dateKey: string): Promise<void> {
    this.timeline = this.timeline.filter((e: MemoryEntry) => e.id !== dateKey);
    return this.persist();
  }

  async mergeAppends(appends: Record<string, string>): Promise<number> {
    const dateKeys = Object.keys(appends).filter((k) => appends[k]?.trim());
    if (dateKeys.length === 0) return 0;

    dateKeys.forEach((dateKey: string) => {
      const appendBlock = `<append>${appends[dateKey].trim()}</append>`;
      const existing = this.timeline.find((e: MemoryEntry) => e.id === dateKey);
      if (existing) {
        existing.text = existing.text
          ? `${existing.text}\n\n${appendBlock}`
          : appendBlock;
      } else {
        this.timeline.push({
          id: dateKey,
          text: appendBlock,
          readableDate: formatReadableDate(dateKey),
        });
      }
    });

    await this.persist();
    return dateKeys.length;
  }

  async changePassword(oldPassword: string, newPassword: string): Promise<boolean> {
    if (this.sessionKey !== oldPassword) return false;
    this.sessionKey = newPassword;
    try {
      await this.persist();
    } catch (err) {
      this.sessionKey = oldPassword;
      throw err;
    }
    return true;
  }

  exportRaw(): Promise<string | null> {
    return this.storage.getItem(VAULT_KEY);
  }

  importRaw(raw: string): Promise<void> {
    return this.storage.setItem(VAULT_KEY, raw);
  }

  private persist(): Promise<void> {
    if (this.sessionKey === null) return Promise.resolve();
    this.dirty = true;
    if (!this.flushing) this.flushing = this.flush();
    return this.flushing;
  }

  private async flush(): Promise<void> {
    try {
      while (this.dirty) {
        this.dirty = false;
        if (this.sessionKey === null) return;
        const payload: VaultData = {
          version: VAULT_FORMAT_VERSION,
          timeline: this.timeline,
        };
        const ciphertext = this.encryption.encrypt(
          JSON.stringify(payload),
          this.sessionKey
        );
        await this.storage.setItem(VAULT_KEY, ciphertext);
      }
    } finally {
      this.flushing = null;
    }
  }
}