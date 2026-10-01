import { Image } from 'expo-image';
import * as Haptics from 'expo-haptics';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { draftToInput, ReceiptForm } from '@/components/receipt-form';
import { AppText, Card, Icon, ModalHeader, Screen } from '@/components/ui';
import { Radius, Spacing, useTheme } from '@/constants/theme';
import { today } from '@/lib/dates';
import { showMessage } from '@/lib/dialogs';
import { announceReceipt, createReceipt } from '@/lib/receipts';
import { prepareImage, readReceipt, type PreparedImage } from '@/lib/scan';
import type { ReceiptDraft } from '@/lib/types';
import { useHousehold } from '@/providers/app-provider';

type Status = 'manual' | 'reading' | 'read' | 'failed';

export default function ReviewScreen() {
  const theme = useTheme();
  const params = useLocalSearchParams<{ uri?: string; width?: string; height?: string }>();
  const { household, notifyReceiptsChanged } = useHousehold();

  const [draft, setDraft] = useState<ReceiptDraft>({
    merchant: '',
    total: '',
    purchased_on: today(),
    category: 'other',
    notes: '',
    items: [],
  });
  const [image, setImage] = useState<PreparedImage | null>(null);
  const [status, setStatus] = useState<Status>(params.uri ? 'reading' : 'manual');
  const [scanError, setScanError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const { uri, width, height } = params;
    if (!uri) return;
    let cancelled = false;
    (async () => {
      try {
        const prepared = await prepareImage({ uri, width: Number(width), height: Number(height) });
        if (cancelled) return;
        setImage(prepared);
        const result = await readReceipt(prepared.base64);
        if (cancelled) return;
        setDraft((d) => ({
          ...d,
          merchant: result.merchant,
          total: result.total > 0 ? result.total.toFixed(2) : '',
          purchased_on: result.purchased_on > today() ? today() : result.purchased_on,
          category: result.category,
          notes: result.summary ?? '',
          items: (result.items ?? []).map((item) => ({ name: item.name, price: item.price.toFixed(2) })),
        }));
        setStatus('read');
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } catch (e) {
        if (cancelled) return;
        setScanError(e instanceof Error ? e.message : 'Couldn’t read the receipt.');
        setStatus('failed');
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      }
    })();
    return () => {
      cancelled = true;
    };
    // Scan once per photo.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.uri]);

  const input = draftToInput(draft);

  const save = async () => {
    if (!input) return;
    setSaving(true);
    try {
      const receiptId = await createReceipt(household.id, input, image?.base64);
      announceReceipt(receiptId);
      notifyReceiptsChanged();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.back();
    } catch (e) {
      console.warn('Saving receipt failed', e);
      showMessage('Couldn’t save', 'Check your connection and try again.');
      setSaving(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: theme.background }}>
      <ModalHeader
        title={params.uri ? 'New receipt' : 'Add expense'}
        onCancel={() => router.back()}
        onSave={save}
        saving={saving}
        saveDisabled={!input || status === 'reading'}
      />
      <Screen>
        {params.uri ? (
          <Image
            source={{ uri: image?.uri ?? params.uri }}
            style={[styles.photo, { backgroundColor: theme.fill }]}
            contentFit="contain"
            accessibilityLabel="Receipt photo"
          />
        ) : null}

        {status === 'reading' ? (
          <Card style={styles.status}>
            <ActivityIndicator />
            <AppText variant="subhead">Reading receipt…</AppText>
          </Card>
        ) : status === 'read' ? (
          <Card style={styles.status}>
            <Icon name="checkmark.circle" size={20} color={theme.accent} />
            <AppText variant="subhead" style={{ flex: 1 }}>
              Double-check the details, then tap Save.
            </AppText>
          </Card>
        ) : status === 'failed' ? (
          <Card style={styles.status}>
            <Icon name="exclamationmark.triangle" size={20} color={theme.danger} />
            <AppText variant="subhead" style={{ flex: 1 }}>
              {scanError} You can fill in the details yourself.
            </AppText>
          </Card>
        ) : null}

        <View style={{ opacity: status === 'reading' ? 0.4 : 1 }}>
          <ReceiptForm
            draft={draft}
            onChange={setDraft}
            currency={household.currency}
            disabled={status === 'reading'}
          />
        </View>
      </Screen>
    </View>
  );
}

const styles = StyleSheet.create({
  photo: { height: 200, borderRadius: Radius.lg, borderCurve: 'continuous' },
  status: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, paddingVertical: Spacing.md },
});
