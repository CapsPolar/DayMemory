/**
 * A single day's journal entry in the encrypted timeline (the "vault").
 * `id` is the date key in YYYY-MM-DD form.
 * `aiInsights` maps an agent's name -> the last insight text generated for
 * that day (or null if the insight was manually cleared but the key is
 * still tracked).
 */
export interface MemoryEntry {
  id: string;
  text: string;
  readableDate: string;
  aiInsights: Record<string, string | null>;
}

export type Timeline = MemoryEntry[];

/** Runtime shape check used when loading parsed JSON back into a Timeline. */
export function isTimeline(value: unknown): value is Timeline {
  return (
    Array.isArray(value) &&
    value.every(
      (item) =>
        typeof item === "object" &&
        item !== null &&
        typeof (item as MemoryEntry).id === "string" &&
        typeof (item as MemoryEntry).text === "string"
    )
  );
}
