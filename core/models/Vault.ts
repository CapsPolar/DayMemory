import { type AgentProfile, isAgentProfile } from "./Agent";
import { type Timeline, isTimeline } from "./Memory";

/**
 * Current on-disk format of the decrypted vault payload — i.e. what gets
 * JSON.stringify'd and then encrypted into the "vault string".
 *
 *   v1 (legacy): the payload was just a bare Timeline array.
 *   v2:          { version: 2, timeline, agents }
 */
export const VAULT_FORMAT_VERSION = 2;

export interface VaultData {
  version: number;
  timeline: Timeline;
  agents: AgentProfile[];
}

export function createEmptyVault(): VaultData {
  return { version: VAULT_FORMAT_VERSION, timeline: [], agents: [] };
}

/**
 * Validates parsed vault JSON and normalizes it to VaultData. Accepts both
 * the legacy v1 shape (a bare Timeline array — agents come back empty) and
 * the v2 object shape. Returns null if the data isn't a valid vault.
 */
export function parseVaultData(value: unknown): VaultData | null {
  // v1: bare timeline array
  if (isTimeline(value)) {
    return { version: VAULT_FORMAT_VERSION, timeline: value, agents: [] };
  }

  // v2: { version, timeline, agents }
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return null;
  }
  const obj = value as Record<string, unknown>;
  if (!isTimeline(obj.timeline)) return null;

  const agents = obj.agents === undefined ? [] : obj.agents;
  if (!Array.isArray(agents) || !agents.every(isAgentProfile)) return null;

  return {
    version: VAULT_FORMAT_VERSION,
    timeline: obj.timeline,
    agents,
  };
}
