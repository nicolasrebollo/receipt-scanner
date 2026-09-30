import { Image } from 'expo-image';
import * as Haptics from 'expo-haptics';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet, View } from 'react-native';

import { draftToInput, ReceiptForm } from '@/components/receipt-form';
import { AppText, Button, ModalHeader, Screen } from '@/components/ui';
import { Radius, Spacing, useTheme } from '@/constants/theme';
import { formatDay, toISODate } from '@/lib/dates';
import { deleteReceipt, getReceipt, receiptImageUrl, updateReceipt } from '@/lib/receipts';
import type { Receipt, ReceiptDraft } from '@/lib/types';
import { useHousehold } from '@/providers/app-provider';

function toDraft(r: Receipt): ReceiptDraft {
  return {
    merchant: r.merchant,
    total: r.total.toFixed(2),
    purchased_on: r.purchased_on,
    category: r.category,
    notes: r.notes ?? '',
  };
}

export default function ReceiptDetailScreen() {
  const theme = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { household, notifyReceiptsChanged, memberName } = useHousehold();

  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const [draft, setDraft] = useState<ReceiptDraft | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getReceipt(id)
      .then(async (r) => {
        if (cancelled) return;
        setReceipt(r);
        setDraft(toDraft(r));
        if (r.image_path) {
          const url = await receiptImageUrl(r.image_path);
          if (!cancelled) setImageUrl(url);
        }
      })
      .catch(() => !cancelled && setLoadError(true));
    return () => {
      cancelled = true;
    };
  }, [id]);

  const input = draft ? draftToInput(draft) : null;
  const changed = !!receipt && !!draft && JSON.stringify(draft) !== JSON.stringify(toDraft(receipt));

  const save = async () => {
    if (!input) return;
    setBusy(true);
    try {
      await updateReceipt(id, input);
      notifyReceiptsChanged();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.back();
    } catch {
      Alert.alert('Couldn’t save', 'Check your connection and try again.');
      setBusy(false);
    }
  };

  const confirmDelete = () => {
    if (!receipt) return;
    Alert.alert('Delete this receipt?', 'It will be removed for everyone in your household.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          setBusy(true);
          try {
            await deleteReceipt(receipt);
            notifyReceiptsChanged();
            router.back();
          } catch {
            Alert.alert('Couldn’t delete', 'Check your connection and try again.');
            setBusy(false);
          }
        },
      },
    ]);
  };

  return (
    <View style={{ flex: 1, backgroundColor: theme.background }}>
      <ModalHeader
        title="Receipt"
        onCancel={() => router.back()}
        onSave={save}
        saving={busy}
        saveDisabled={!changed || !input}
      />
      {!receipt || !draft ? (
        <View style={styles.center}>
          {loadError ? (
            <AppText tone="secondary">This receipt couldn’t be loaded.</AppText>
          ) : (
            <ActivityIndicator />
          )}
        </View>
      ) : (
        <Screen>
          {receipt.image_path ? (
            <Image
              source={imageUrl ? { uri: imageUrl } : undefined}
              style={[styles.photo, { backgroundColor: theme.fill }]}
              contentFit="contain"
              transition={200}
              accessibilityLabel="Receipt photo"
            />
          ) : null}
          <ReceiptForm draft={draft} onChange={setDraft} currency={household.currency} />
          <AppText variant="footnote" tone="muted" style={{ textAlign: 'center' }}>
            Added by {memberName(receipt.created_by)} on{' '}
            {formatDay(toISODate(new Date(receipt.created_at)), { withYear: true })}
          </AppText>
          <Button
            title="Delete receipt"
            icon="trash"
            variant="destructive"
            onPress={confirmDelete}
            disabled={busy}
          />
        </Screen>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.md },
  photo: { height: 280, borderRadius: Radius.lg, borderCurve: 'continuous' },
});
