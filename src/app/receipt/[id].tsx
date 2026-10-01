import { Image } from 'expo-image';
import * as Haptics from 'expo-haptics';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { draftToInput, ReceiptForm } from '@/components/receipt-form';
import { AppText, Button, ModalHeader, Screen } from '@/components/ui';
import { Radius, Spacing, useTheme } from '@/constants/theme';
import { formatDay, toISODate } from '@/lib/dates';
import { confirmAction, showMessage } from '@/lib/dialogs';
import {
  deleteReceipt,
  getReceipt,
  receiptImageBase64,
  receiptImageUrl,
  updateReceipt,
} from '@/lib/receipts';
import { readReceipt } from '@/lib/scan';
import type { Receipt, ReceiptDraft } from '@/lib/types';
import { useHousehold } from '@/providers/app-provider';

function toDraft(r: Receipt): ReceiptDraft {
  return {
    merchant: r.merchant,
    total: r.total.toFixed(2),
    purchased_on: r.purchased_on,
    category: r.category,
    notes: r.notes ?? '',
    items: r.items.map((item) => ({ name: item.name, price: item.price.toFixed(2) })),
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
  const [rereading, setRereading] = useState(false);

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
      showMessage('Couldn’t save', 'Check your connection and try again.');
      setBusy(false);
    }
  };

  // Fills in the summary and item list for a receipt saved before those existed (or to redo them).
  // Merchant, amount, date and category are left alone, and nothing is stored until Save is tapped.
  const rereadPhoto = async () => {
    if (!receipt?.image_path || !draft) return;
    if (draft.items.length > 0) {
      const replace = await confirmAction({
        title: 'Replace the item list?',
        message: 'The items shown now will be replaced with what’s read from the photo.',
        confirmLabel: 'Replace',
      });
      if (!replace) return;
    }
    setRereading(true);
    try {
      const result = await readReceipt(await receiptImageBase64(receipt.image_path));
      if (result.items === undefined) {
        showMessage(
          'Server update needed',
          'The scan function on the server doesn’t return items yet. Redeploy it, then try again.',
        );
        return;
      }
      const items = result.items.map((item) => ({ name: item.name, price: item.price.toFixed(2) }));
      // Keep a summary the person wrote themselves; only fill an empty one.
      setDraft((d) => d && { ...d, items, notes: d.notes.trim() ? d.notes : (result.summary ?? '') });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      if (items.length === 0) showMessage('No items found', 'This photo doesn’t show an itemized list.');
    } catch (e) {
      showMessage('Couldn’t read the photo', e instanceof Error ? e.message : 'Try again in a moment.');
    } finally {
      setRereading(false);
    }
  };

  const confirmDelete = async () => {
    if (!receipt) return;
    const confirmed = await confirmAction({
      title: 'Delete this receipt?',
      message: 'It will be removed for everyone in your household.',
      confirmLabel: 'Delete',
      destructive: true,
    });
    if (!confirmed) return;
    setBusy(true);
    try {
      await deleteReceipt(receipt);
      notifyReceiptsChanged();
      router.back();
    } catch {
      showMessage('Couldn’t delete', 'Check your connection and try again.');
      setBusy(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: theme.background }}>
      <ModalHeader
        title="Receipt"
        onCancel={() => router.back()}
        onSave={save}
        saving={busy}
        saveDisabled={!changed || !input || rereading}
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
          {receipt.image_path ? (
            <Button
              title="Read items from photo"
              icon="doc.text.viewfinder"
              variant="secondary"
              onPress={rereadPhoto}
              loading={rereading}
              disabled={busy}
            />
          ) : null}
          <View style={{ opacity: rereading ? 0.4 : 1 }}>
            <ReceiptForm
              draft={draft}
              onChange={setDraft}
              currency={household.currency}
              disabled={rereading}
            />
          </View>
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
