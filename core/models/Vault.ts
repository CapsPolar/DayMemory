/**
 * Current on-disk format of the decrypted vault payload — i.e. what gets
 * JSON.stringify'd and then encrypted into the "vault string".
 *
 *   v1-v3 (legacy): array/object shapes with timeline/agents/entries.
 *   v4:             { version: 4, content: string }
 */
export const VAULT_FORMAT_VERSION = 4;

export interface VaultData {
  version: number;
  content: string;
}

export function createEmptyVault(): VaultData {
  return { version: VAULT_FORMAT_VERSION, content: "" };
}

/**
 * Validates and normalizes parsed JSON vault data into VaultData.
 * Accepts new v4 objects as well as legacy shapes (converting old structures
 * directly into readable text so nothing is lost).
 */
export function parseVaultData(parsed: unknown, rawDecrypted: string): VaultData {
  // 1. If it's a plain string that was parsed, use it
  if (typeof parsed === "string") {
    return { version: VAULT_FORMAT_VERSION, content: parsed };
  }

  // 2. If it's an object/array shape
  if (typeof parsed === "object" && parsed !== null) {
    const obj = parsed as Record<string, unknown>;

    // New format: { version, content }
    if (typeof obj.content === "string") {
      return { version: VAULT_FORMAT_VERSION, content: obj.content };
    }

    // Old legacy data (arrays, timeline objects, etc.) -> stringify so it displays as-is
    return {
      version: VAULT_FORMAT_VERSION,
      content: JSON.stringify(parsed, null, 2),
    };
  }

  // 3. Fallback for primitive unformatted parsed values
  return { version: VAULT_FORMAT_VERSION, content: rawDecrypted };
} 