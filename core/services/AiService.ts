import type { StoragePort } from "../ports/StoragePort";
import type { AiEnginePort } from "../ports/AiEnginePort";
import type { MemoryEntry } from "../models/Memory";
import { type AgentProfile } from "../models/Agent";
import { type AiConfig, DEFAULT_AI_CONFIG } from "../models/Settings";

const CONFIG_KEY = "dayMemoryGlobalAiConfig";
const PROFILES_KEY = "dayMemoryAiProfiles";

/**
 * Manages agent profiles, global AI engine config, running analysis via
 * AiEnginePort, and turning an agent's insight history into CSV.
 */
export class AiService {
  constructor(
    private readonly storage: StoragePort,
    private readonly engine: AiEnginePort
  ) {}

  getConfig(): AiConfig {
    const raw = this.storage.getItem(CONFIG_KEY);
    return raw ? JSON.parse(raw) : DEFAULT_AI_CONFIG;
  }

  saveConfig(config: AiConfig): void {
    this.storage.setItem(CONFIG_KEY, JSON.stringify(config));
  }

  listAgents(): AgentProfile[] {
    const raw = this.storage.getItem(PROFILES_KEY);
    return raw ? JSON.parse(raw) : [];
  }

  private persistAgents(agents: AgentProfile[]): void {
    this.storage.setItem(PROFILES_KEY, JSON.stringify(agents));
  }

  createAgent(name: string, prompt: string): AgentProfile {
    const agents = this.listAgents();
    if (agents.some((p) => p.name.toLowerCase() === name.toLowerCase())) {
      throw new Error("An identical profile moniker exists.");
    }
    const profile: AgentProfile = { name, prompt };
    agents.push(profile);
    this.persistAgents(agents);
    return profile;
  }

  /** Renames/reconfigures an existing agent. Caller is responsible for also
   * calling VaultService.renameAgentInsights() when the name changes. */
  updateAgent(oldName: string, newName: string, prompt: string): AgentProfile {
    const agents = this.listAgents();
    const idx = agents.findIndex((p) => p.name === oldName);
    if (idx === -1) throw new Error("Agent not found.");
    const updated: AgentProfile = { name: newName, prompt };
    agents[idx] = updated;
    this.persistAgents(agents);
    return updated;
  }

  deleteAgent(name: string): void {
    this.persistAgents(this.listAgents().filter((p) => p.name !== name));
  }

  /** Runs the agent's prompt against a single day's text via the AiEnginePort. */
  analyze(agent: AgentProfile, text: string): Promise<string | null> {
    return this.engine.generate(this.getConfig(), agent.prompt, text);
  }

  /**
   * Turns an agent's insight history into a CSV string: `baseHeaders` as
   * the first row, then one row per non-blank line of insight text per
   * day (oldest to newest), date-prefixed, with numeric-looking cells
   * converted to numbers.
   */
  generateCsv(
    baseHeaders: string,
    timeline: MemoryEntry[],
    agentName: string
  ): string {
    const lines: string[] = [baseHeaders];
    const ordered = [...timeline].sort((a, b) => a.id.localeCompare(b.id));

    ordered.forEach((entry) => {
      const rawInsight = entry.aiInsights?.[agentName] ?? "";
      if (!rawInsight || !rawInsight.trim()) return;

      rawInsight.split(/\r?\n/).forEach((line: string) => {
        const cleanedLine = line.trim();
        if (!cleanedLine) return;

        const rawCells = cleanedLine.split(",");
        const rowCells: (string | number)[] = [this.escapeCsvCell(entry.id)];

        rawCells.forEach((cell: string) => {
          let standardCell = cell.trim();
          if (standardCell.startsWith('"') && standardCell.endsWith('"')) {
            standardCell = standardCell.slice(1, -1).trim();
          }
          if (standardCell !== "" && !isNaN(Number(standardCell))) {
            rowCells.push(Number(standardCell));
          } else {
            rowCells.push(this.escapeCsvCell(standardCell));
          }
        });

        lines.push(rowCells.join(", "));
      });
    });

    return lines.join("\n");
  }

  private escapeCsvCell(text: unknown): string {
    if (text === null || text === undefined) return '""';
    const stringValue = String(text);
    if (/["\n\r,]/.test(stringValue)) {
      return '"' + stringValue.replace(/"/g, '""') + '"';
    }
    return stringValue;
  }
}
