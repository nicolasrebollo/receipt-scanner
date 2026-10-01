import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import { DateField } from '@/components/date-field';
import { AppText, Card, Chip, Icon, Separator, TextField } from '@/components/ui';
import { Radius, Spacing, useTheme } from '@/constants/theme';
import { CATEGORIES, type CategoryId } from '@/lib/categories';
import { today } from '@/lib/dates';
import { currencySymbol, formatMoney, parseAmount } from '@/lib/money';
import type { ReceiptDraft } from '@/lib/types';
import type { ReceiptInput } from '@/lib/receipts';

const MAX_ITEMS = 60;

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
    items: draft.items
      .map((item) => ({ name: item.name.trim().slice(0, 80), price: parseAmount(item.price) ?? 0 }))
      .filter((item) => item.name || item.price > 0)
      .map((item) => ({ ...item, name: item.name || 'Item' }))
      .slice(0, MAX_ITEMS),
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

  const setItem = (index: number, patch: Partial<ReceiptDraft['items'][number]>) =>
    set(
      'items',
      draft.items.map((item, i) => (i === index ? { ...item, ...patch } : item)),
    );
  const itemsTotal = draft.items.reduce((sum, item) => sum + (parseAmount(item.price) ?? 0), 0);

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
        label="Summary"
        value={draft.notes}
        onChangeText={(t) => set('notes', t)}
        placeholder="What was this for? (optional)"
        multiline
        maxLength={500}
        style={{ minHeight: 80, paddingTop: 14 }}
      />

      <View style={{ gap: Spacing.sm }}>
        <AppText variant="footnote" tone="secondary">
          Items
        </AppText>
        <Card style={styles.itemsCard}>
          {draft.items.map((item, i) => (
            <View key={i}>
              <View style={styles.itemRow}>
                <TextInput
                  value={item.name}
                  onChangeText={(t) => setItem(i, { name: t })}
                  placeholder="Item"
                  placeholderTextColor={theme.textMuted}
                  accessibilityLabel={`Item ${i + 1} name`}
                  maxLength={80}
                  style={[styles.itemName, { color: theme.text }]}
                />
                <TextInput
                  value={item.price}
                  onChangeText={(t) => setItem(i, { price: t.replace(/[^0-9.,]/g, '') })}
                  placeholder="0.00"
                  placeholderTextColor={theme.textMuted}
                  keyboardType="decimal-pad"
                  accessibilityLabel={`Item ${i + 1} price`}
                  style={[styles.itemPrice, { color: theme.text }]}
                />
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Remove ${item.name || `item ${i + 1}`}`}
                  hitSlop={10}
                  onPress={() =>
                    set(
                      'items',
                      draft.items.filter((_, index) => index !== i),
                    )
                  }>
                  <Icon name="xmark" size={14} color={theme.textMuted} />
                </Pressable>
              </View>
              <Separator />
            </View>
          ))}
          <Pressable
            accessibilityRole="button"
            disabled={draft.items.length >= MAX_ITEMS}
            onPress={() => set('items', [...draft.items, { name: '', price: '' }])}
            style={({ pressed }) => [styles.addItem, { opacity: pressed ? 0.6 : 1 }]}>
            <Icon name="plus" size={16} color={theme.accent} weight="semibold" />
            <AppText variant="body" tone="accent">
              Add item
            </AppText>
          </Pressable>
        </Card>
        {itemsTotal > 0 ? (
          <View style={styles.itemsFooter}>
            <AppText variant="footnote" tone="secondary">
              Items add up to {formatMoney(itemsTotal, currency)}
            </AppText>
            {draft.total === '' ? (
              <Pressable
                accessibilityRole="button"
                hitSlop={8}
                onPress={() => set('total', itemsTotal.toFixed(2))}>
                <AppText variant="footnote" tone="accent">
                  Use as total
                </AppText>
              </Pressable>
            ) : null}
          </View>
        ) : null}
      </View>
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
  itemsCard: { paddingVertical: 0, borderRadius: Radius.md },
  itemRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  // minWidth 0 lets the name field shrink on web instead of pushing the price off-screen.
  itemName: { flex: 1, minWidth: 0, fontSize: 17, paddingVertical: 13 },
  itemPrice: {
    width: 76,
    fontSize: 17,
    paddingVertical: 13,
    textAlign: 'right',
    fontVariant: ['tabular-nums'],
  },
  addItem: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingVertical: 13 },
  itemsFooter: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: Spacing.xs },
});
