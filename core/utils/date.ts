/**
 * Pure date helpers shared by the vault and the UI. Framework-agnostic —
 * uses only the built-in Date object, no browser-only APIs.
 *
 * Not part of your originally requested folder list, but VaultService needs
 * formatReadableDate() to build entries, so it lives here in core rather
 * than being duplicated in the webapp. See the summary for this note.
 */

/** Today's date as a YYYY-MM-DD key, in the user's local timezone. */
export function getTodayKey(): string {
  const d = new Date();
  const offset = d.getTimezoneOffset();
  const localDate = new Date(d.getTime() - offset * 60 * 1000);
  return localDate.toISOString().split("T")[0];
}

/** Converts a YYYY-MM-DD key into a human-readable date string. */
export function formatReadableDate(dateKey: string): string {
  const [year, month, day] = dateKey.split("-").map(Number);
  const dateObj = new Date(year, month - 1, day);
  return dateObj.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

/** A "[M/D/YYYY, h:mm AM/PM]: " stamp for auto-timestamping entries. */
export function getTimestampString(): string {
  const now = new Date();
  const formatted = now.toLocaleString("en-US", {
    month: "numeric",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
  return `[${formatted}]: `;
}
