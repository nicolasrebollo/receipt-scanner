import { router } from 'expo-router';
import { useMemo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { ReceiptRow } from '@/components/receipt-row';
import { AppText, Button, Card, EmptyState, Icon, Screen, SectionHeader, Separator } from '@/components/ui';
import { Radius, Spacing, useTheme } from '@/constants/theme';
import { useReceipts } from '@/hooks/use-receipts';
import { formatDay, monthRange } from '@/lib/dates';
import { formatMoney } from '@/lib/money';
import { pickReceiptImage } from '@/lib/scan';
import { useHousehold } from '@/providers/app-provider';

export default function ScanScreen() {
  const theme = useTheme();
  const { household } = useHousehold();
  const range = useMemo(() => monthRange(new Date()), []);
  const { receipts, reload, loading } = useReceipts({ range });

  const total = receipts.reduce((sum, r) => sum + r.total, 0);
  const monthName = new Date().toLocaleDateString(undefined, { month: 'long' });

  const scan = async (source: 'camera' | 'library') => {
    const image = await pickReceiptImage(source);
    if (!image) return;
    router.push({
      pathname: '/review',
      params: { uri: image.uri, width: String(image.width), height: String(image.height) },
    });
  };

  return (
    <Screen title={household.name} onRefresh={reload}>
      <View style={styles.hero}>
        <AppText variant="footnote" tone="secondary">
          Spent in {monthName}
        </AppText>
        <AppText variant="hero" accessibilityRole="summary">
          {formatMoney(total, household.currency)}
        </AppText>
        <AppText variant="footnote" tone="secondary">
          {receipts.length === 1 ? '1 receipt' : `${receipts.length} receipts`}
        </AppText>
      </View>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Scan a receipt with the camera"
        onPress={() => scan('camera')}
        style={({ pressed }) => [
          styles.scanButton,
          { backgroundColor: theme.accent, opacity: pressed ? 0.85 : 1 },
        ]}>
        <Icon name="camera" size={30} color={theme.accentText} />
        <AppText variant="title" tone="onAccent">
          Scan receipt
        </AppText>
      </Pressable>

      <View style={styles.secondaryRow}>
        <Button
          title="From photos"
          icon="photo"
          variant="secondary"
          onPress={() => scan('library')}
          style={{ flex: 1 }}
        />
        <Button
          title="Type it in"
          icon="square.and.pencil"
          variant="secondary"
          onPress={() => router.push('/review')}
          style={{ flex: 1 }}
        />
      </View>

      <SectionHeader
        title="Recent"
        action={
          receipts.length > 0 ? (
            <Button
              title="See all"
              variant="plain"
              onPress={() => router.navigate('/history')}
              style={styles.seeAll}
            />
          ) : null
        }
      />
      <Card style={{ paddingVertical: Spacing.xs }}>
        {receipts.length === 0 && !loading ? (
          <EmptyState icon="doc.text" title="No receipts this month" message="Scan your first one above." />
        ) : (
          receipts.slice(0, 5).map((r, i) => (
            <View key={r.id}>
              {i > 0 ? <Separator inset={48} /> : null}
              <ReceiptRow receipt={r} subtitle={formatDay(r.purchased_on)} />
            </View>
          ))
        )}
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: { alignItems: 'center', gap: 2, paddingVertical: Spacing.lg },
  scanButton: {
    height: 120,
    borderRadius: Radius.lg,
    borderCurve: 'continuous',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
  },
  secondaryRow: { flexDirection: 'row', gap: Spacing.md },
  seeAll: { minHeight: 0, paddingHorizontal: 0 },
});
