import type { AiConfig } from "../models/Settings";

/**
 * Port the core depends on to run an agent's prompt against a piece of
 * journal text. The webapp connects this to an adapter (e.g. OllamaAdapter).
 */
export interface AiEnginePort {
  /** Returns the model's response text, or null if the call failed. */
  generate(
    config: AiConfig,
    systemPrompt: string,
    userText: string
  ): Promise<string | null>;
}
