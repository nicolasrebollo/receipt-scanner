// Hermes (the JS engine on the phone) supports only basic Intl.NumberFormat: no formatToParts,
// no compact notation. Stick to plain currency formatting here.
type Style = 'full' | 'whole';

const formatters = new Map<string, Intl.NumberFormat>();

function formatter(currency: string, style: Style) {
  const key = `${currency}:${style}`;
  let f = formatters.get(key);
  if (!f) {
    f = new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency,
      ...(style === 'whole' ? { maximumFractionDigits: 0, minimumFractionDigits: 0 } : {}),
    });
    formatters.set(key, f);
  }
  return f;
}

export function formatMoney(amount: number, currency: string): string {
  return formatter(currency, 'full').format(amount);
}

/** "$" for USD, "€" for EUR: a formatted zero with the digits stripped. */
export function currencySymbol(currency: string): string {
  return (
    formatter(currency, 'whole')
      .format(0)
      .replace(/[0-9\s\u00a0\u202f]/g, '') || currency
  );
}

/** Short form for chart axes: $80, $1.2K. */
export function formatMoneyCompact(amount: number, currency: string): string {
  if (amount < 1000) return formatter(currency, 'whole').format(amount);
  const [value, suffix] = amount >= 1_000_000 ? [amount / 1_000_000, 'M'] : [amount / 1000, 'K'];
  const digits = new Intl.NumberFormat(undefined, { maximumFractionDigits: 1 }).format(value) + suffix;
  const symbol = currencySymbol(currency);
  const symbolFirst = formatter(currency, 'whole').format(0).trim().startsWith(symbol);
  return symbolFirst ? `${symbol}${digits}` : `${digits} ${symbol}`;
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
