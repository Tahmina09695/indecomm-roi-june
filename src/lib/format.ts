// Display formatters.

export const fmtCurrency = (n: number, opts: { compact?: boolean } = {}) => {
  if (!isFinite(n)) return "$0";
  if (opts.compact && Math.abs(n) >= 1_000_000) {
    return `$${(n / 1_000_000).toFixed(2)}M`;
  }
  if (opts.compact && Math.abs(n) >= 1_000) {
    return `$${(n / 1_000).toFixed(1)}K`;
  }
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(n);
};

export const fmtCurrencyPrecise = (n: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 }).format(n);

export const fmtPercent = (n: number, digits = 1) =>
  `${(n * 100).toFixed(digits)}%`;

export const fmtNumber = (n: number, digits = 1) =>
  new Intl.NumberFormat("en-US", { maximumFractionDigits: digits }).format(n);

export const fmtFTE = (n: number) => fmtNumber(n, 2);
