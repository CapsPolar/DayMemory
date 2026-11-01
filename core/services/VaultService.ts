import type { StoragePort } from "../ports/StoragePort";
import type { EncryptionPort } from "../ports/EncryptionPort";
import { VAULT_FORMAT_VERSION, parseVaultData, type VaultData } from "../models/Vault";

const VAULT_KEY = "dayMemoryVault";

/**
 * Owns the decrypted, in-memory continuous text string and all read/write operations.
 * Completely stripped of date partitioning, timeline arrays, and AI agents[cite: 6].
 */
export class VaultService {
  private content: string = "";
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
      data = { version: VAULT_FORMAT_VERSION, content: "" };
    } else {
      const decrypted = this.encryption.decrypt(encrypted, password);
      if (decrypted === null) return false;

      try {
        const parsed = JSON.parse(decrypted);
        data = parseVaultData(parsed, decrypted);
      } catch {
        // Unformatted plain text or raw non-JSON string -> treat as-is
        data = { version: VAULT_FORMAT_VERSION, content: decrypted };
      }
    }

    this.content = data.content;
    this.sessionKey = password;
    return true;
  }

  lock(): void {
    this.sessionKey = null;
    this.content = "";
    this.dirty = false;
  }

  getContent(): string {
    return this.content;
  }

  saveContent(newContent: string): Promise<void> {
    this.content = newContent;
    return this.persist();
  }

  appendContent(textToAppend: string): Promise<void> {
    const trimmed = textToAppend.trim();
    if (!trimmed) return Promise.resolve();

    this.content = this.content
      ? `${this.content}\n\n${trimmed}`
      : trimmed;

    return this.persist();
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
          content: this.content,
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