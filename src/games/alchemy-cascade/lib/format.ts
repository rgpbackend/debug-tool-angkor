/** GDD 2.2: 7 integer digits + 2 fractional digits. */
export function formatAlchemyBalance(amount: string): string {
  const n = Number(amount);
  if (!Number.isFinite(n)) {
    return amount;
  }
  const negative = n < 0;
  const [intRaw, frac = "00"] = Math.abs(n).toFixed(2).split(".");
  const intPart = intRaw.length >= 7 ? intRaw : intRaw.padStart(7, "0");
  return `${negative ? "-" : ""}${intPart}.${frac}`;
}

export function formatAlchemyMoney(amount: string): string {
  const n = Number(amount);
  if (!Number.isFinite(n)) {
    return amount;
  }
  return n.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}
