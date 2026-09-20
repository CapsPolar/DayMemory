/**
 * An AI insight agent: a named system prompt that gets run against journal
 * entries to produce per-day insight text.
 */
export interface AgentProfile {
  name: string;
  prompt: string;
}
