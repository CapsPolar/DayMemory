/** Global configuration for the local AI engine (currently: an Ollama server). */
export interface AiConfig {
  endpoint: string;
  model: string;
}

export const DEFAULT_AI_CONFIG: AiConfig = {
  endpoint: "http://127.0.0.1:11434",
  model: "llama3",
};
