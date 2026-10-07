import type { StoragePort } from "../ports/StoragePort";
import type { EncryptionPort } from "../ports/EncryptionPort";
import { type MemoryEntry, type Timeline } from "../models/Memory";
import { type AgentProfile } from "../models/Agent";
import {
  type VaultData,
  VAULT_FORMAT_VERSION,
  parseVaultData,
} from "../models/Vault";
import { formatReadableDate } from "../utils/date";

const VAULT_KEY = "dayMemoryVault";

/**
 * Owns the decrypted, in-memory timeline + agent profiles and all
 * read/write operations on them. Everything that's persisted — entries,
 * insights, AND agents — is serialized together as one VaultData payload
 * and encrypted into a single "vault string".
 *
 * Talks to the outside world only through StoragePort (persistence) and
 * EncryptionPort (crypto) — no IndexedDB, no CryptoJS import here.
 *
 * Reads are synchronous (served from memory once unlocked). Mutations
 * update memory immediately, then return a promise that resolves once the
 * change is durably written.
 */
export class VaultService {
  private timeline: Timeline = [];
  private agents: AgentProfile[] = [];
  private sessionKey: string | null = null;

  // Write coalescing: rapid mutations (e.g. typing in an insight box) mark
  // the vault dirty; a single flush loop always writes the latest state.
  private dirty = false;
  private flushing: Promise<void> | null = null;

  constructor(
    private readonly storage: StoragePort,
    private readonly encryption: EncryptionPort
  ) {}

  get isUnlocked(): boolean {
    return this.sessionKey !== null;
  }

  /** True if an encrypted vault already exists in storage. */
  async hasVault(): Promise<boolean> {
    return (await this.storage.getItem(VAULT_KEY)) !== null;
  }

  /**
   * Attempts to unlock the vault with `password`. If no vault exists yet,
   * this "creates" an empty one under that password. Returns false if the
   * password is wrong or the stored data is corrupt. Throws only if
   * storage itself fails.
   *
   * Accepts both the current vault format and the legacy one (a bare
   * timeline array); legacy vaults are upgraded on their next write.
   */
  async unlock(password: string): Promise<boolean> {
    const encrypted = await this.storage.getItem(VAULT_KEY);

    let data: VaultData;
    if (!encrypted) {
      data = { version: VAULT_FORMAT_VERSION, timeline: [], agents: [] };
    } else {
      const decrypted = this.encryption.decrypt(encrypted, password);
      if (decrypted === null) return false;

      let parsed: unknown;
      try {
        parsed = JSON.parse(decrypted);
      } catch {
        return false;
      }
      const valid = parseVaultData(parsed);
      if (!valid) return false;
      data = valid;
    }

    this.timeline = data.timeline;
    this.agents = data.agents;
    this.sessionKey = password;
    return true;
  }

  lock(): void {
    this.sessionKey = null;
    this.timeline = [];
    this.agents = [];
    this.dirty = false;
  }

  // ---------------------------------------------------------------------
  // Timeline
  // ---------------------------------------------------------------------

  /** Entries sorted newest-first, the order the Home timeline renders in. */
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
        aiInsights: {},
      });
    }
    return this.persist();
  }

  deleteEntry(dateKey: string): Promise<void> {
    this.timeline = this.timeline.filter((e: MemoryEntry) => e.id !== dateKey);
    return this.persist();
  }

  /**
   * Merges pending (unencrypted) buffer text into the vault as <append>
   * blocks, one per date key that has non-blank buffer text. Resolves to
   * how many dates were merged (0 = nothing to do) — and only after the
   * merged vault has been durably written, so it's safe for the caller to
   * clear the buffer once this resolves. Does not clear the buffer itself.
   */
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
          aiInsights: {},
        });
      }
    });

    await this.persist();
    return dateKeys.length;
  }

  setInsight(
    dateKey: string,
    agentName: string,
    text: string | null
  ): Promise<void> {
    const entry = this.timeline.find((e: MemoryEntry) => e.id === dateKey);
    if (!entry) return Promise.resolve();
    if (!entry.aiInsights) entry.aiInsights = {};
    if (text) entry.aiInsights[agentName] = text;
    else delete entry.aiInsights[agentName];
    return this.persist();
  }

  /** Clears every entry's insight for the given agent (manual clear). */
  clearAgentInsights(agentName: string): Promise<void> {
    this.timeline.forEach((entry: MemoryEntry) => {
      if (entry.aiInsights && entry.aiInsights[agentName] !== undefined) {
        delete entry.aiInsights[agentName];
      }
    });
    return this.persist();
  }

  // ---------------------------------------------------------------------
  // Agents (stored inside the encrypted vault payload)
  // ---------------------------------------------------------------------

  /** Agent profiles in creation order. Empty while the vault is locked. */
  listAgents(): AgentProfile[] {
    return this.agents.map((a) => ({ ...a }));
  }

  async createAgent(name: string, prompt: string): Promise<AgentProfile> {
    this.requireUnlocked();
    if (!name.trim()) throw new Error("Agent name is required.");
    if (this.agentNameTaken(name)) {
      throw new Error("An identical profile moniker exists.");
    }
    const profile: AgentProfile = { name, prompt };
    this.agents.push(profile);
    try {
      await this.persist();
    } catch (err) {
      this.agents = this.agents.filter((a) => a !== profile);
      throw err;
    }
    return { ...profile };
  }

  /**
   * Renames/reconfigures an existing agent. If the name changes, every
   * entry's insights are moved to the new name in the same write, so the
   * agent list and the insight keys can never get out of sync.
   */
  async updateAgent(
    oldName: string,
    newName: string,
    prompt: string
  ): Promise<AgentProfile> {
    this.requireUnlocked();
    const idx = this.agents.findIndex((p) => p.name === oldName);
    if (idx === -1) throw new Error("Agent not found.");
    if (!newName.trim()) throw new Error("Agent name is required.");
    if (this.agentNameTaken(newName, oldName)) {
      throw new Error("An identical profile moniker exists.");
    }

    if (newName !== oldName) this.renameAgentInsights(oldName, newName);
    const updated: AgentProfile = { name: newName, prompt };
    this.agents[idx] = updated;
    await this.persist();
    return { ...updated };
  }

  /** Removes the agent profile. Historic insight text on entries is kept. */
  async deleteAgent(name: string): Promise<void> {
    this.requireUnlocked();
    this.agents = this.agents.filter((p) => p.name !== name);
    await this.persist();
  }

  // ---------------------------------------------------------------------
  // Password / backup
  // ---------------------------------------------------------------------

  /**
   * Re-keys the vault: verifies `oldPassword` against the current session
   * key, then re-encrypts and persists under `newPassword`. Returns false
   * (no state change) if `oldPassword` doesn't match. If the write fails,
   * the session key is rolled back and the error is rethrown.
   */
  async changePassword(
    oldPassword: string,
    newPassword: string
  ): Promise<boolean> {
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

  /**
   * The raw encrypted vault string, for backup/export. It contains the
   * timeline, insights, and agent profiles.
   */
  exportRaw(): Promise<string | null> {
    return this.storage.getItem(VAULT_KEY);
  }

  /** Overwrites the stored vault with a raw encrypted string (restore). Caller should reload the app after this. */
  importRaw(raw: string): Promise<void> {
    return this.storage.setItem(VAULT_KEY, raw);
  }

  // ---------------------------------------------------------------------
  // Internals
  // ---------------------------------------------------------------------

  private requireUnlocked(): void {
    if (this.sessionKey === null) throw new Error("Vault is locked.");
  }

  private agentNameTaken(name: string, ignoreName?: string): boolean {
    const lower = name.toLowerCase();
    return this.agents.some(
      (p) => p.name !== ignoreName && p.name.toLowerCase() === lower
    );
  }

  /** Moves every entry's insight under `oldName` to `newName`. In-memory only; caller persists. */
  private renameAgentInsights(oldName: string, newName: string): void {
    this.timeline.forEach((entry: MemoryEntry) => {
      const existing = entry.aiInsights?.[oldName];
      if (entry.aiInsights && existing !== undefined) {
        entry.aiInsights[newName] = existing;
        delete entry.aiInsights[oldName];
      }
    });
  }

  /**
   * Marks the vault dirty and makes sure a flush is running. The returned
   * promise resolves once the latest state at the time of the call (or
   * newer) has been durably written. Encryption happens at flush time, so
   * a burst of mutations costs one encrypt+write per flush, not per call.
   */
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
          agents: this.agents,
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
