import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { ReceiptRow } from '@/components/receipt-row';
import { AppText, Card, EmptyState, Icon, ModalHeader, Screen, Segmented, Separator } from '@/components/ui';
import { Spacing, useTheme } from '@/constants/theme';
import { useReceipts } from '@/hooks/use-receipts';
import { categoryById, type CategoryId } from '@/lib/categories';
import { formatDay } from '@/lib/dates';
import { formatMoney } from '@/lib/money';
import { useHousehold } from '@/providers/app-provider';

type Sort = 'newest' | 'largest';

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Every expense in one category for a period, opened from a category row in Insights. */
export default function CategoryScreen() {
  const theme = useTheme();
  const { household } = useHousehold();
  const params = useLocalSearchParams<{ category?: string; start?: string; end?: string; period?: string }>();
  const category = categoryById(params.category ?? '');
  const [sort, setSort] = useState<Sort>('newest');

  const valid = ISO_DATE.test(params.start ?? '') && ISO_DATE.test(params.end ?? '');
  const range = useMemo(
    () => (valid ? { start: params.start!, end: params.end! } : undefined),
    [valid, params.start, params.end],
  );
  const { receipts, loading, error, reload } = useReceipts({
    range,
    category: category.id as CategoryId,
  });

  const sorted = useMemo(
    () => (sort === 'largest' ? [...receipts].sort((a, b) => b.total - a.total) : receipts),
    [receipts, sort],
  );
  const total = receipts.reduce((sum, r) => sum + r.total, 0);
  const currentYear = String(new Date().getFullYear());

  return (
    <View style={{ flex: 1, backgroundColor: theme.background }}>
      <ModalHeader title={category.label} cancelLabel="Done" onCancel={() => router.back()} />
      <Screen onRefresh={reload}>
        <View style={styles.hero}>
          <View style={[styles.badge, { backgroundColor: theme.fill }]}>
            <Icon name={category.icon} size={22} />
          </View>
          <AppText variant="footnote" tone="secondary">
            {params.period ?? 'All time'}
          </AppText>
          <AppText variant="hero">{formatMoney(total, household.currency)}</AppText>
          <AppText variant="footnote" tone="secondary">
            {receipts.length === 1 ? '1 expense' : `${receipts.length} expenses`}
          </AppText>
        </View>

        {receipts.length > 1 ? (
          <Segmented
            options={[
              { value: 'newest', label: 'Newest first' },
              { value: 'largest', label: 'Largest first' },
            ]}
            value={sort}
            onChange={setSort}
          />
        ) : null}

        {loading ? (
          <ActivityIndicator style={{ marginTop: Spacing.lg }} />
        ) : error ? (
          <EmptyState icon="wifi.exclamationmark" title="Couldn’t load" message={error} />
        ) : sorted.length === 0 ? (
          <EmptyState
            icon={category.icon}
            title={`No ${category.label.toLowerCase()} expenses`}
            message="Nothing in this period."
          />
        ) : (
          <Card style={{ paddingVertical: Spacing.xs }}>
            {sorted.map((r, i) => (
              <View key={r.id}>
                {i > 0 ? <Separator inset={48} /> : null}
                <ReceiptRow
                  receipt={r}
                  subtitle={formatDay(r.purchased_on, { withYear: !r.purchased_on.startsWith(currentYear) })}
                />
              </View>
            ))}
          </Card>
        )}
      </Screen>
    </View>
  );
}

const styles = StyleSheet.create({
  hero: { alignItems: 'center', gap: 2, paddingVertical: Spacing.sm },
  badge: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.sm,
  },
});
