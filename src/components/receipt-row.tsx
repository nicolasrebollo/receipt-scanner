import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText, Icon } from '@/components/ui';
import { Spacing, useTheme } from '@/constants/theme';
import { categoryById } from '@/lib/categories';
import { formatMoney } from '@/lib/money';
import type { Receipt } from '@/lib/types';
import { useHousehold } from '@/providers/app-provider';

export function CategoryBadge({ category, size = 36 }: { category: string; size?: number }) {
  const theme = useTheme();
  return (
    <View
      style={[
        styles.badge,
        { width: size, height: size, borderRadius: size / 2, backgroundColor: theme.fill },
      ]}>
      <Icon name={categoryById(category).icon} size={size * 0.46} />
    </View>
  );
}

export function ReceiptRow({ receipt, subtitle }: { receipt: Receipt; subtitle?: string }) {
  const { household, members, memberName } = useHousehold();
  const category = categoryById(receipt.category);
  const detail = [subtitle ?? category.label, members.length > 1 ? memberName(receipt.created_by) : null]
    .filter(Boolean)
    .join(' · ');

  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => router.push({ pathname: '/receipt/[id]', params: { id: receipt.id } })}
      style={({ pressed }) => [styles.row, { opacity: pressed ? 0.6 : 1 }]}>
      <CategoryBadge category={receipt.category} />
      <View style={styles.text}>
        <AppText variant="headline" numberOfLines={1}>
          {receipt.merchant}
        </AppText>
        <AppText variant="footnote" tone="secondary" numberOfLines={1}>
          {detail}
        </AppText>
      </View>
      <AppText variant="headline" style={styles.amount}>
        {formatMoney(receipt.total, household.currency)}
      </AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  badge: { alignItems: 'center', justifyContent: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, paddingVertical: Spacing.md },
  text: { flex: 1, gap: 2 },
  amount: { fontVariant: ['tabular-nums'] },
});
