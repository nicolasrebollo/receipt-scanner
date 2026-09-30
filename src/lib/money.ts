type Style = 'full' | 'whole' | 'compact';

const formatters = new Map<string, Intl.NumberFormat>();

function formatter(currency: string, style: Style) {
  const key = `${currency}:${style}`;
  let f = formatters.get(key);
  if (!f) {
    f = new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency,
      ...(style === 'whole' ? { maximumFractionDigits: 0, minimumFractionDigits: 0 } : {}),
      ...(style === 'compact' ? { notation: 'compact', maximumFractionDigits: 1 } : {}),
    });
    formatters.set(key, f);
  }
  return f;
}

export function formatMoney(amount: number, currency: string): string {
  return formatter(currency, 'full').format(amount);
}

/** Short form for chart axes: $80, $1.2K. */
export function formatMoneyCompact(amount: number, currency: string): string {
  return formatter(currency, amount < 1000 ? 'whole' : 'compact').format(amount);
}

/** Parses what the user typed ("12.5", "1,234.56", "$8") into a number, or null. */
export function parseAmount(input: string): number | null {
  // The iOS decimal pad shows the locale's separator, so a lone comma is a decimal point ("12,50").
  const normalized = input.includes('.') ? input : input.replace(',', '.');
  const cleaned = normalized.replace(/[^0-9.]/g, '');
  if (!cleaned || cleaned.split('.').length > 2) return null;
  const n = Number(cleaned);
  return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) / 100 : null;
}
