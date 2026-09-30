import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, SectionList, StyleSheet, TextInput, View } from 'react-native';

import { ReceiptRow } from '@/components/receipt-row';
import {
  AppText,
  Chip,
  EmptyState,
  Icon,
  ScreenTitle,
  Separator,
  Stepper,
  useRefresh,
  useWebTopInset,
} from '@/components/ui';
import { Radius, Spacing, useTheme } from '@/constants/theme';
import { useReceipts } from '@/hooks/use-receipts';
import { CATEGORIES, type CategoryId } from '@/lib/categories';
import { addMonths, formatDay, formatMonth, monthRange } from '@/lib/dates';
import { formatMoney } from '@/lib/money';
import type { Receipt } from '@/lib/types';
import { useHousehold } from '@/providers/app-provider';

type Section = { title: string; total: number; data: Receipt[] };

function useDebounced<T>(value: T, ms: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return debounced;
}

export default function HistoryScreen() {
  const theme = useTheme();
  const { household } = useHousehold();

  const [month, setMonth] = useState<Date | null>(() => new Date()); // null = all time
  const [category, setCategory] = useState<CategoryId | undefined>();
  const [searchText, setSearchText] = useState('');
  const search = useDebounced(searchText.trim(), 250);

  const range = useMemo(() => (month ? monthRange(month) : undefined), [month]);
  const { receipts, loading, error, reload } = useReceipts({ range, search, category });
  const refreshControl = useRefresh(reload);
  const topInset = useWebTopInset();

  const sections = useMemo(() => {
    const byDay = new Map<string, Section>();
    for (const r of receipts) {
      let s = byDay.get(r.purchased_on);
      if (!s) {
        s = { title: r.purchased_on, total: 0, data: [] };
        byDay.set(r.purchased_on, s);
      }
      s.total += r.total;
      s.data.push(r);
    }
    return [...byDay.values()];
  }, [receipts]);

  const total = receipts.reduce((sum, r) => sum + r.total, 0);
  const isCurrentMonth = month !== null && monthRange(month).start === monthRange(new Date()).start;
  const currentYear = new Date().getFullYear();

  const header = (
    <View style={styles.header}>
      <ScreenTitle title="History" />

      <View style={[styles.search, { backgroundColor: theme.fill }]}>
        <Icon name="magnifyingglass" size={16} color={theme.textMuted} />
        <TextInput
          value={searchText}
          onChangeText={setSearchText}
          placeholder="Search merchants and notes"
          placeholderTextColor={theme.textMuted}
          returnKeyType="search"
          autoCorrect={false}
          clearButtonMode="while-editing"
          style={[styles.searchInput, { color: theme.text }]}
        />
      </View>

      <View style={styles.monthRow}>
        <View style={{ flex: 1 }}>
          {month ? (
            <Stepper
              label={formatMonth(month)}
              onPrev={() => setMonth(addMonths(month, -1))}
              onNext={() => setMonth(addMonths(month, 1))}
              nextDisabled={isCurrentMonth}
            />
          ) : (
            <AppText variant="headline" style={{ textAlign: 'center' }}>
              All time
            </AppText>
          )}
        </View>
        <Chip
          label={month ? 'All time' : 'By month'}
          selected={false}
          onPress={() => setMonth(month ? null : new Date())}
        />
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.chipScroller}
        contentContainerStyle={styles.chips}>
        <Chip label="All" selected={!category} onPress={() => setCategory(undefined)} />
        {CATEGORIES.map((c) => (
          <Chip
            key={c.id}
            label={c.label}
            icon={c.icon}
            selected={category === c.id}
            onPress={() => setCategory(category === c.id ? undefined : c.id)}
          />
        ))}
      </ScrollView>

      <AppText variant="footnote" tone="secondary" style={{ paddingHorizontal: Spacing.xs }}>
        {receipts.length === 1 ? '1 receipt' : `${receipts.length} receipts`} ·{' '}
        {formatMoney(total, household.currency)}
      </AppText>
    </View>
  );

  return (
    <SectionList
      style={{ flex: 1, backgroundColor: theme.background }}
      contentInsetAdjustmentBehavior="automatic"
      keyboardDismissMode="on-drag"
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={[styles.content, { paddingTop: Spacing.lg + topInset }]}
      refreshControl={refreshControl}
      sections={sections}
      keyExtractor={(r) => r.id}
      stickySectionHeadersEnabled={false}
      ListHeaderComponent={header}
      renderSectionHeader={({ section }) => (
        <View style={styles.dayHeader}>
          <AppText variant="footnote" tone="secondary" style={{ fontWeight: '600' }}>
            {formatDay(section.title, { withYear: !section.title.startsWith(String(currentYear)) })}
          </AppText>
          <AppText variant="footnote" tone="secondary" style={{ fontVariant: ['tabular-nums'] }}>
            {formatMoney(section.total, household.currency)}
          </AppText>
        </View>
      )}
      renderItem={({ item, index, section }) => (
        <View
          style={[
            styles.item,
            { backgroundColor: theme.card },
            index === 0 && styles.itemFirst,
            index === section.data.length - 1 && styles.itemLast,
          ]}>
          {index > 0 ? <Separator inset={48} /> : null}
          <ReceiptRow receipt={item} />
        </View>
      )}
      ListEmptyComponent={
        loading ? null : error ? (
          <EmptyState icon="wifi.exclamationmark" title="Couldn’t load" message={error} />
        ) : (
          <EmptyState
            icon="magnifyingglass"
            title="No receipts found"
            message={
              search || category ? 'Try a different search or filter.' : 'Nothing was added for this period.'
            }
          />
        )
      }
      ListFooterComponent={
        receipts.length > 0 && month ? (
          <Pressable onPress={() => setMonth(addMonths(month, -1))} style={styles.footer}>
            <AppText variant="subhead" tone="accent">
              Show {formatMonth(addMonths(month, -1))}
            </AppText>
          </Pressable>
        ) : null
      }
    />
  );
}

const styles = StyleSheet.create({
  content: { padding: Spacing.lg, paddingBottom: Spacing.xxl * 2 },
  header: { gap: Spacing.lg, marginBottom: Spacing.sm },
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    borderRadius: Radius.sm,
    paddingHorizontal: Spacing.md,
  },
  searchInput: { flex: 1, fontSize: 17, paddingVertical: 10 },
  monthRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  chipScroller: { marginHorizontal: -Spacing.lg },
  chips: { gap: Spacing.sm, paddingHorizontal: Spacing.lg },
  dayHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.xs,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.sm,
  },
  item: { paddingHorizontal: Spacing.lg },
  itemFirst: { borderTopLeftRadius: Radius.lg, borderTopRightRadius: Radius.lg, paddingTop: Spacing.xs },
  itemLast: {
    borderBottomLeftRadius: Radius.lg,
    borderBottomRightRadius: Radius.lg,
    paddingBottom: Spacing.xs,
  },
  footer: { alignItems: 'center', paddingVertical: Spacing.xl },
});
