export function formatMoney(amount, currency) {
  const n = Number(amount) || 0;
  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency,
      minimumFractionDigits: n % 1 ? 2 : 0,
      maximumFractionDigits: 2,
    }).format(n);
  } catch {
    return `${currency} ${n.toFixed(n % 1 ? 2 : 0)}`;
  }
}

export function currencySymbol(currency) {
  try {
    const parts = new Intl.NumberFormat(undefined, { style: 'currency', currency }).formatToParts(0);
    return parts.find((p) => p.type === 'currency')?.value ?? currency;
  } catch {
    return currency;
  }
}

// Reads a typed amount like "1,250.50" as a number; empty or invalid input gives null
export function parseAmount(text) {
  const n = parseFloat(String(text ?? '').replace(/[^0-9.]/g, ''));
  return Number.isFinite(n) ? n : null;
}
