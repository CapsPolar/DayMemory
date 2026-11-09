const TRAILING_EMPTY_TS = /\n?\[TIME \d{2}\/\d{2}\/\d{4} \d{2}:\d{2}\]:\s*$/;

/**
 * Appends a fresh quick timestamp. If the text already ends with a timestamp
 * nobody typed after (e.g. a page reload), that one is replaced instead of stacked.
 */
export function withFreshTimestamp(text: string): string {
  const base = text.replace(TRAILING_EMPTY_TS, "");
  const ts = getQuickTimestamp();
  return base.trim() ? base + ts : ts.trimStart();
}
/** User-friendly timestamp in \n[TIME day/month/year hour:minute]: format. */
export function getQuickTimestamp(): string {
  const now = new Date();
  const day = String(now.getDate()).padStart(2, "0");
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const year = now.getFullYear();
  const hours = String(now.getHours()).padStart(2, "0");
  const minutes = String(now.getMinutes()).padStart(2, "0");
  return `\n[TIME ${day}/${month}/${year} ${hours}:${minutes}]: `;
}