import type { AiEnginePort } from "@core/ports/AiEnginePort";
import type { AiConfig } from "@core/models/Settings";

/** AiEnginePort implementation that talks to a local Ollama server over fetch. */
export class OllamaAdapter implements AiEnginePort {
  async generate(
    config: AiConfig,
    systemPrompt: string,
    userText: string
  ): Promise<string | null> {
    try {
      const response = await fetch(`${config.endpoint}/api/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: config.model,
          prompt: `System Prompt Instructions: ${systemPrompt}\n\nJournal entry context content:\n"${userText}"`,
          stream: false,
        }),
      });
      if (!response.ok) throw new Error("Request failed");
      const data = await response.json();
      return String(data.response).trim();
    } catch {
      alert(
        `Network connectivity dropped to Ollama API environment configuration path at: ${config.endpoint}. Double check CORS parameters.`
      );
      return null;
    }
  }
}
