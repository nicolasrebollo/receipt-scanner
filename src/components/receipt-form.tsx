import { StyleSheet, TextInput, View } from 'react-native';

import { DateField } from '@/components/date-field';
import { AppText, Card, Chip, TextField } from '@/components/ui';
import { Radius, Spacing, useTheme } from '@/constants/theme';
import { CATEGORIES, type CategoryId } from '@/lib/categories';
import { today } from '@/lib/dates';
import { currencySymbol, parseAmount } from '@/lib/money';
import type { ReceiptDraft } from '@/lib/types';
import type { ReceiptInput } from '@/lib/receipts';

export function draftToInput(draft: ReceiptDraft): ReceiptInput | null {
  const total = parseAmount(draft.total);
  const merchant = draft.merchant.trim();
  if (total === null || !merchant) return null;
  return {
    merchant,
    total,
    purchased_on: draft.purchased_on,
    category: draft.category,
    notes: draft.notes.trim() || null,
  };
}

export function ReceiptForm({
  draft,
  onChange,
  currency,
  disabled,
}: {
  draft: ReceiptDraft;
  onChange: (draft: ReceiptDraft) => void;
  currency: string;
  disabled?: boolean;
}) {
  const theme = useTheme();
  const set = <K extends keyof ReceiptDraft>(key: K, value: ReceiptDraft[K]) =>
    onChange({ ...draft, [key]: value });

  return (
    <View style={styles.form} pointerEvents={disabled ? 'none' : 'auto'}>
      <View style={styles.amountRow}>
        <AppText variant="hero" tone="muted">
          {currencySymbol(currency)}
        </AppText>
        <TextInput
          value={draft.total}
          onChangeText={(t) => set('total', t.replace(/[^0-9.,]/g, ''))}
          placeholder="0.00"
          placeholderTextColor={theme.textMuted}
          keyboardType="decimal-pad"
          accessibilityLabel="Amount"
          // Size the field to its contents so the amount stays centered (web inputs don't auto-size).
          style={[styles.amountInput, { color: theme.text, width: (draft.total.length || 4) * 30 + 8 }]}
        />
      </View>

      <TextField
        label="Merchant"
        value={draft.merchant}
        onChangeText={(t) => set('merchant', t)}
        placeholder="Where did you shop?"
        autoCapitalize="words"
        returnKeyType="done"
      />

      <Card style={styles.dateCard}>
        <AppText variant="body">Date</AppText>
        <DateField value={draft.purchased_on} max={today()} onChange={(d) => set('purchased_on', d)} />
      </Card>

      <View style={{ gap: Spacing.sm }}>
        <AppText variant="footnote" tone="secondary">
          Category
        </AppText>
        <View style={styles.chips}>
          {CATEGORIES.map((c) => (
            <Chip
              key={c.id}
              label={c.label}
              icon={c.icon}
              selected={draft.category === c.id}
              onPress={() => set('category', c.id as CategoryId)}
            />
          ))}
        </View>
      </View>

      <TextField
        label="Note"
        value={draft.notes}
        onChangeText={(t) => set('notes', t)}
        placeholder="Optional"
        multiline
        maxLength={500}
        style={{ minHeight: 80, paddingTop: 14 }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  form: { gap: Spacing.lg },
  amountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xs,
    paddingVertical: Spacing.md,
  },
  amountInput: {
    fontSize: 48,
    fontWeight: '700',
    letterSpacing: -1,
    fontVariant: ['tabular-nums'],
  },
  dateCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Spacing.sm,
    borderRadius: Radius.md,
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
});
