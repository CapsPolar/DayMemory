import type { StoragePort } from "../ports/StoragePort";
import type { AiEnginePort } from "../ports/AiEnginePort";
import type { MemoryEntry } from "../models/Memory";
import type { AgentProfile } from "../models/Agent";
import { type AiConfig, DEFAULT_AI_CONFIG } from "../models/Settings";

const CONFIG_KEY = "dayMemoryGlobalAiConfig";

/**
 * Manages the global AI engine config, runs analysis via AiEnginePort, and
 * turns an agent's insight history into CSV.
 *
 * Agent profiles themselves (name + prompt) are NOT managed here: they live
 * inside the encrypted vault, so VaultService owns create/update/delete.
 */
export class AiService {
  constructor(
    private readonly storage: StoragePort,
    private readonly engine: AiEnginePort
  ) {}

  async getConfig(): Promise<AiConfig> {
    const raw = await this.storage.getItem(CONFIG_KEY);
    if (!raw) return { ...DEFAULT_AI_CONFIG };
    try {
      return { ...DEFAULT_AI_CONFIG, ...JSON.parse(raw) };
    } catch {
      return { ...DEFAULT_AI_CONFIG };
    }
  }

  async saveConfig(config: AiConfig): Promise<void> {
    await this.storage.setItem(CONFIG_KEY, JSON.stringify(config));
  }

  /** Runs the agent's prompt against a single day's text via the AiEnginePort. */
  async analyze(agent: AgentProfile, text: string): Promise<string | null> {
    return this.engine.generate(await this.getConfig(), agent.prompt, text);
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
