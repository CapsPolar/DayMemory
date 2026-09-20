import type { StoragePort } from "../ports/StoragePort";
import type { EncryptionPort } from "../ports/EncryptionPort";
import { type MemoryEntry, type Timeline, isTimeline } from "../models/Memory";
import { formatReadableDate } from "../utils/date";

const VAULT_KEY = "dayMemoryVault";

/**
 * Owns the decrypted, in-memory timeline and all read/write operations on
 * it. Talks to the outside world only through StoragePort (persistence)
 * and EncryptionPort (crypto) — no localStorage, no CryptoJS import here.
 */
export class VaultService {
  private timeline: Timeline = [];
  private sessionKey: string | null = null;

  constructor(
    private readonly storage: StoragePort,
    private readonly encryption: EncryptionPort
  ) {}

  get isUnlocked(): boolean {
    return this.sessionKey !== null;
  }

  /**
   * Attempts to unlock the vault with `password`. If no vault exists yet,
   * this "creates" an empty one under that password. Returns false if the
   * password is wrong or the stored data is corrupt.
   */
  unlock(password: string): boolean {
    const encrypted = this.storage.getItem(VAULT_KEY);
    if (!encrypted) {
      this.sessionKey = password;
      this.timeline = [];
      return true;
    }

    const decrypted = this.encryption.decrypt(encrypted, password);
    if (decrypted === null) return false;

    try {
      const parsed: unknown = JSON.parse(decrypted);
      if (!isTimeline(parsed)) return false;
      this.timeline = parsed;
    } catch {
      return false;
    }

    this.sessionKey = password;
    return true;
  }

  lock(): void {
    this.sessionKey = null;
    this.timeline = [];
  }

  /** Entries sorted newest-first, the order the Home timeline renders in. */
  getTimeline(): Timeline {
    return [...this.timeline].sort((a, b) => b.id.localeCompare(a.id));
  }

  getEntry(dateKey: string): MemoryEntry | undefined {
    return this.timeline.find((e: MemoryEntry) => e.id === dateKey);
  }

  saveEntry(dateKey: string, text: string): void {
    const existing = this.timeline.find((e: MemoryEntry) => e.id === dateKey);
    if (existing) {
      existing.text = text;
    } else {
      this.timeline.push({
        id: dateKey,
        text,
        readableDate: formatReadableDate(dateKey),
        aiInsights: {},
      });
    }
    this.persist();
  }

  deleteEntry(dateKey: string): void {
    this.timeline = this.timeline.filter((e: MemoryEntry) => e.id !== dateKey);
    this.persist();
  }

  /**
   * Merges pending (unencrypted) buffer text into the vault as <append>
   * blocks, one per date key that has non-blank buffer text. Returns how
   * many dates were merged (0 = nothing to do). Does not clear the buffer
   * itself — that's BufferService's job, orchestrated by the caller.
   */
  mergeAppends(appends: Record<string, string>): number {
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
          aiInsights: {},
        });
      }
    });

    this.persist();
    return dateKeys.length;
  }

  setInsight(dateKey: string, agentName: string, text: string | null): void {
    const entry = this.timeline.find((e: MemoryEntry) => e.id === dateKey);
    if (!entry) return;
    if (!entry.aiInsights) entry.aiInsights = {};
    if (text) entry.aiInsights[agentName] = text;
    else delete entry.aiInsights[agentName];
    this.persist();
  }

  /** Moves every entry's insight under `oldName` to `newName` (agent rename). */
  renameAgentInsights(oldName: string, newName: string): void {
    let changed = false;
    this.timeline.forEach((entry: MemoryEntry) => {
      const existing = entry.aiInsights?.[oldName];
      if (entry.aiInsights && existing !== undefined) {
        entry.aiInsights[newName] = existing;
        delete entry.aiInsights[oldName];
        changed = true;
      }
    });
    if (changed) this.persist();
  }

  /** Clears every entry's insight for the given agent (agent deletion / manual clear). */
  clearAgentInsights(agentName: string): void {
    this.timeline.forEach((entry: MemoryEntry) => {
      if (entry.aiInsights && entry.aiInsights[agentName] !== undefined) {
        delete entry.aiInsights[agentName];
      }
    });
    this.persist();
  }

  /**
   * Re-keys the vault: verifies `oldPassword` against the current session
   * key, then re-encrypts and persists under `newPassword`. Returns false
   * (no state change) if `oldPassword` doesn't match.
   */
  changePassword(oldPassword: string, newPassword: string): boolean {
    if (this.sessionKey !== oldPassword) return false;
    this.sessionKey = newPassword;
    this.persist();
    return true;
  }

  /** The raw encrypted vault string, for backup/export. */
  exportRaw(): string | null {
    return this.storage.getItem(VAULT_KEY);
  }

  /** Overwrites the stored vault with a raw encrypted string (restore). Caller should reload the app after this. */
  importRaw(raw: string): void {
    this.storage.setItem(VAULT_KEY, raw);
  }

  private persist(): void {
    if (this.sessionKey === null) return;
    const ciphertext = this.encryption.encrypt(
      JSON.stringify(this.timeline),
      this.sessionKey
    );
    this.storage.setItem(VAULT_KEY, ciphertext);
  }
}
