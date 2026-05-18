export function formatBet(level: string): string {
  const n = Number(level);
  if (!Number.isFinite(n)) {
    return level;
  }
  return Number.isInteger(n) ? String(n) : n.toFixed(4);
}
