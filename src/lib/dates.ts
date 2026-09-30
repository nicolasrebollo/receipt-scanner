// Receipt dates are plain local calendar days stored as "YYYY-MM-DD".

export type DateRange = { start: string; end: string }; // inclusive

export type PeriodKind = 'day' | 'week' | 'month' | 'year' | 'custom';

const pad = (n: number) => String(n).padStart(2, '0');

export function toISODate(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function parseISODate(s: string): Date {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function today(): string {
  return toISODate(new Date());
}

export function addDays(d: Date, n: number): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
}

export function addMonths(d: Date, n: number): Date {
  return new Date(d.getFullYear(), d.getMonth() + n, 1);
}

export function daysBetween(a: string, b: string): number {
  return Math.round((parseISODate(b).getTime() - parseISODate(a).getTime()) / 86_400_000);
}

export function monthRange(d: Date): DateRange {
  return {
    start: toISODate(new Date(d.getFullYear(), d.getMonth(), 1)),
    end: toISODate(new Date(d.getFullYear(), d.getMonth() + 1, 0)),
  };
}

export function periodRange(kind: Exclude<PeriodKind, 'custom'>, anchor: Date): DateRange {
  switch (kind) {
    case 'day':
      return { start: toISODate(anchor), end: toISODate(anchor) };
    case 'week': {
      const start = addDays(anchor, -anchor.getDay()); // weeks start on Sunday
      return { start: toISODate(start), end: toISODate(addDays(start, 6)) };
    }
    case 'month':
      return monthRange(anchor);
    case 'year':
      return { start: `${anchor.getFullYear()}-01-01`, end: `${anchor.getFullYear()}-12-31` };
  }
}

export function shiftPeriod(kind: Exclude<PeriodKind, 'custom'>, anchor: Date, dir: 1 | -1): Date {
  switch (kind) {
    case 'day':
      return addDays(anchor, dir);
    case 'week':
      return addDays(anchor, 7 * dir);
    case 'month':
      return addMonths(anchor, dir);
    case 'year':
      return new Date(anchor.getFullYear() + dir, 0, 1);
  }
}

export function periodLabel(kind: Exclude<PeriodKind, 'custom'>, anchor: Date): string {
  const now = new Date();
  switch (kind) {
    case 'day': {
      const iso = toISODate(anchor);
      if (iso === today()) return 'Today';
      if (iso === toISODate(addDays(now, -1))) return 'Yesterday';
      return formatDay(iso, { withYear: anchor.getFullYear() !== now.getFullYear() });
    }
    case 'week': {
      const { start, end } = periodRange('week', anchor);
      return `${formatShort(start)} – ${formatShort(end)}`;
    }
    case 'month':
      return formatMonth(anchor);
    case 'year':
      return String(anchor.getFullYear());
  }
}

export function formatMonth(d: Date): string {
  return d.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
}

export function formatShort(iso: string): string {
  return parseISODate(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export function formatDay(iso: string, opts: { withYear?: boolean } = {}): string {
  return parseISODate(iso).toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    ...(opts.withYear ? { year: 'numeric' } : {}),
  });
}

export function formatRange({ start, end }: DateRange): string {
  const sameYear = start.slice(0, 4) === end.slice(0, 4);
  const opts: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric', year: 'numeric' };
  const a = parseISODate(start).toLocaleDateString(
    undefined,
    sameYear ? { month: 'short', day: 'numeric' } : opts,
  );
  const b = parseISODate(end).toLocaleDateString(undefined, opts);
  return `${a} – ${b}`;
}
