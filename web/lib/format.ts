/**
 * Formatters for dates, durations, and costs.
 * @module lib/format
 */

/** Format a unix timestamp as elapsed time (e.g. "3m ago", "2h ago"). */
export function formatElapsed(unixSeconds: number): string {
  const diff = Math.floor(Date.now() / 1000) - unixSeconds;
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

/** Format cost as $X.XX */
export function formatCost(usd: number): string {
  return `$${usd.toFixed(2)}`;
}

/** Format a unix timestamp as a date string. */
export function formatDate(unixSeconds: number): string {
  return new Date(unixSeconds * 1000).toLocaleString();
}
