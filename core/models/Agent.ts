/**
 * An AI insight agent: a named system prompt that gets run against journal
 * entries to produce per-day insight text.
 *
 * Agents live inside the encrypted vault (see VaultData in ./Vault.ts), so
 * they travel with the vault string on export/import and are never stored
 * in plaintext.
 */
export interface AgentProfile {
  name: string;
  prompt: string;
}

/** Runtime shape check used when loading parsed JSON back into agents. */
export function isAgentProfile(value: unknown): value is AgentProfile {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as AgentProfile).name === "string" &&
    typeof (value as AgentProfile).prompt === "string"
  );
}
