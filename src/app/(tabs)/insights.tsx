import { useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { DateField } from '@/components/date-field';
import { BarChart, Breakdown, type Bar, type BreakdownRow } from '@/components/charts';
import { ReceiptRow } from '@/components/receipt-row';
import {
  AppText,
  Card,
  EmptyState,
  Screen,
  Segmented,
  SectionHeader,
  Separator,
  Stepper,
} from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { useReceipts } from '@/hooks/use-receipts';
import { CATEGORIES } from '@/lib/categories';
import {
  addDays,
  addMonths,
  daysBetween,
  formatRange,
  parseISODate,
  periodLabel,
  periodRange,
  shiftPeriod,
  today,
  toISODate,
  type DateRange,
  type PeriodKind,
} from '@/lib/dates';
import { formatMoney, formatMoneyCompact } from '@/lib/money';
import type { Receipt } from '@/lib/types';
import { useHousehold } from '@/providers/app-provider';

const PERIODS = [
  { value: 'day', label: 'Day' },
  { value: 'week', label: 'Week' },
  { value: 'month', label: 'Month' },
  { value: 'year', label: 'Year' },
  { value: 'custom', label: 'Custom' },
] as const;

/** Splits the range into day or month buckets and sums spending in each. */
function buildBars(kind: PeriodKind, range: DateRange, receipts: Receipt[]): Bar[] {
  const span = daysBetween(range.start, range.end) + 1;
  const byMonth = kind === 'year' || (kind === 'custom' && span > 62);
  const bars: Bar[] = [];
  const index = new Map<string, Bar>();

  if (byMonth) {
    const end = parseISODate(range.end);
    const multiYear = range.start.slice(0, 4) !== range.end.slice(0, 4);
    for (let d = parseISODate(range.start); d <= end; d = addMonths(d, 1)) {
      const key = toISODate(d).slice(0, 7);
      const bar: Bar = {
        key,
        label: d.toLocaleDateString(undefined, { month: 'long', year: 'numeric' }),
        tick: multiYear
          ? d.getMonth() === 0
            ? String(d.getFullYear())
            : undefined
          : d.toLocaleDateString(undefined, { month: 'narrow' }),
        value: 0,
      };
      bars.push(bar);
      index.set(key, bar);
    }
    for (const r of receipts) {
      const bar = index.get(r.purchased_on.slice(0, 7));
      if (bar) bar.value += r.total;
    }
  } else {
    const start = parseISODate(range.start);
    for (let i = 0; i < span; i++) {
      const d = addDays(start, i);
      const key = toISODate(d);
      let tick: string | undefined;
      if (kind === 'week') tick = d.toLocaleDateString(undefined, { weekday: 'narrow' });
      else if (i % 7 === 0) tick = String(d.getDate());
      const bar: Bar = {
        key,
        label: d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' }),
        tick,
        value: 0,
      };
      bars.push(bar);
      index.set(key, bar);
    }
    for (const r of receipts) {
      const bar = index.get(r.purchased_on);
      if (bar) bar.value += r.total;
    }
  }
  return bars;
}

export default function InsightsScreen() {
  const { household, members, memberName } = useHousehold();
  const [kind, setKind] = useState<PeriodKind>('month');
  const [anchor, setAnchor] = useState(() => new Date());

  // The monthly-summary notification opens this screen on a specific month ("?month=2026-09").
  const { month } = useLocalSearchParams<{ month?: string }>();
  const [shownMonth, setShownMonth] = useState<string>();
  if (month && month !== shownMonth && /^\d{4}-(0[1-9]|1[0-2])$/.test(month)) {
    setShownMonth(month);
    setKind('month');
    setAnchor(parseISODate(`${month}-01`));
  }
  const [custom, setCustom] = useState<DateRange>(() => ({
    start: toISODate(addDays(new Date(), -29)),
    end: today(),
  }));

  const range = useMemo(
    () => (kind === 'custom' ? custom : periodRange(kind, anchor)),
    [kind, anchor, custom],
  );
  const { receipts, loading, reload } = useReceipts({ range });

  const money = (n: number) => formatMoney(n, household.currency);
  const total = receipts.reduce((sum, r) => sum + r.total, 0);
  const days = daysBetween(range.start, range.end < today() ? range.end : today()) + 1;

  const bars = useMemo(
    () => (kind === 'day' ? [] : buildBars(kind, range, receipts)),
    [kind, range, receipts],
  );

  const categoryRows = useMemo<BreakdownRow[]>(
    () =>
      CATEGORIES.map((c) => ({
        key: c.id,
        label: c.label,
        icon: c.icon,
        value: receipts.filter((r) => r.category === c.id).reduce((sum, r) => sum + r.total, 0),
      }))
        .filter((row) => row.value > 0)
        .sort((a, b) => b.value - a.value),
    [receipts],
  );

  const personRows = useMemo<BreakdownRow[]>(() => {
    const totals = new Map<string, number>();
    for (const r of receipts) totals.set(r.created_by ?? '', (totals.get(r.created_by ?? '') ?? 0) + r.total);
    return [...totals.entries()]
      .map(([id, value]) => ({ key: id || 'former', label: memberName(id || null), value }))
      .sort((a, b) => b.value - a.value);
  }, [receipts, memberName]);

  const nextStart = kind !== 'custom' ? periodRange(kind, shiftPeriod(kind, anchor, 1)).start : '';
  const trendTitle = bars.length > 0 && bars[0].key.length === 7 ? 'By month' : 'By day';

  return (
    <Screen title="Insights" onRefresh={reload}>
      <Segmented options={PERIODS} value={kind} onChange={setKind} />

      {kind === 'custom' ? (
        <Card style={styles.customRange}>
          <View style={styles.customRow}>
            <AppText variant="body">From</AppText>
            <DateField
              value={custom.start}
              max={custom.end}
              onChange={(d) => setCustom((c) => ({ ...c, start: d }))}
            />
          </View>
          <Separator />
          <View style={styles.customRow}>
            <AppText variant="body">To</AppText>
            <DateField
              value={custom.end}
              min={custom.start}
              max={today()}
              onChange={(d) => setCustom((c) => ({ ...c, end: d }))}
            />
          </View>
        </Card>
      ) : (
        <Stepper
          label={periodLabel(kind, anchor)}
          onPrev={() => setAnchor(shiftPeriod(kind, anchor, -1))}
          onNext={() => setAnchor(shiftPeriod(kind, anchor, 1))}
          nextDisabled={nextStart > today()}
        />
      )}

      <View style={styles.hero}>
        <AppText variant="footnote" tone="secondary">
          {kind === 'custom' ? formatRange(range) : 'Total spent'}
        </AppText>
        <AppText variant="hero">{money(total)}</AppText>
        <AppText variant="footnote" tone="secondary">
          {receipts.length === 1 ? '1 receipt' : `${receipts.length} receipts`}
          {kind !== 'day' && days > 1 && total > 0 ? ` · ${money(total / days)} per day` : ''}
        </AppText>
      </View>

      {receipts.length === 0 && !loading ? (
        <EmptyState icon="chart.bar" title="No spending" message="No receipts were added for this period." />
      ) : kind === 'day' ? (
        <>
          <SectionHeader title="Receipts" />
          <Card style={{ paddingVertical: Spacing.xs }}>
            {receipts.map((r, i) => (
              <View key={r.id}>
                {i > 0 ? <Separator inset={48} /> : null}
                <ReceiptRow receipt={r} />
              </View>
            ))}
          </Card>
        </>
      ) : (
        <>
          <SectionHeader title={trendTitle} />
          <Card>
            <BarChart
              bars={bars}
              format={money}
              formatAxis={(n) => formatMoneyCompact(n, household.currency)}
            />
          </Card>
        </>
      )}

      {categoryRows.length > 0 ? (
        <>
          <SectionHeader title="By category" />
          <Card>
            <Breakdown rows={categoryRows} format={money} />
          </Card>
        </>
      ) : null}

      {members.length > 1 && personRows.length > 0 ? (
        <>
          <SectionHeader title="By person" />
          <Card>
            <Breakdown rows={personRows} format={money} />
          </Card>
        </>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: { alignItems: 'center', gap: 2, paddingVertical: Spacing.sm },
  customRange: { paddingVertical: Spacing.xs },
  customRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Spacing.sm,
  },
});
