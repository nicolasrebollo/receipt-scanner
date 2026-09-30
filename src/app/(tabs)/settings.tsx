import { Pressable, Share, StyleSheet, View } from 'react-native';

import { AppText, Button, Card, Icon, Screen, SectionHeader, Separator } from '@/components/ui';
import { Spacing, useTheme } from '@/constants/theme';
import { chooseOption, confirmAction, promptText, showMessage } from '@/lib/dialogs';
import { supabase } from '@/lib/supabase';
import { useHousehold } from '@/providers/app-provider';

const CURRENCIES = ['USD', 'EUR', 'GBP', 'CAD', 'AUD', 'MXN', 'JPY'];

export default function HouseholdScreen() {
  const theme = useTheme();
  const { household, members, session, refreshHousehold } = useHousehold();
  const userId = session?.user.id;
  const me = members.find((m) => m.user_id === userId);

  const shareInvite = () => {
    const message = `Join our shared budget "${household.name}" in the Receipts app with invite code ${household.invite_code}`;
    // Browsers without a share sheet reject; show the code instead.
    Share.share({ message }).catch(() => showMessage('Invite code', household.invite_code));
  };

  const renameHousehold = async () => {
    const name = await promptText({ title: 'Budget name', defaultValue: household.name });
    if (!name?.trim()) return;
    await supabase.from('households').update({ name: name.trim() }).eq('id', household.id);
    refreshHousehold();
  };

  const renameMe = async () => {
    const name = await promptText({
      title: 'Your name',
      message: 'This is how you appear to others in your household.',
      defaultValue: me?.display_name,
    });
    if (!name?.trim() || !userId) return;
    await supabase
      .from('household_members')
      .update({ display_name: name.trim() })
      .eq('household_id', household.id)
      .eq('user_id', userId);
    refreshHousehold();
  };

  const chooseCurrency = async () => {
    const currency = await chooseOption({ title: 'Currency', options: CURRENCIES, current: household.currency });
    if (!currency || currency === household.currency) return;
    await supabase.from('households').update({ currency }).eq('id', household.id);
    refreshHousehold();
  };

  const leave = async () => {
    const confirmed = await confirmAction({
      title: 'Leave this budget?',
      message:
        members.length > 1
          ? 'You’ll stop seeing its receipts. You can rejoin later with the invite code.'
          : 'You’re the only member, so its receipts will no longer be reachable.',
      confirmLabel: 'Leave',
      destructive: true,
    });
    if (!confirmed) return;
    await supabase.rpc('leave_household');
    refreshHousehold();
  };

  return (
    <Screen title="Household">
      <Card style={styles.invite}>
        <AppText variant="footnote" tone="secondary">
          Invite code
        </AppText>
        <AppText variant="largeTitle" style={styles.code} selectable>
          {household.invite_code}
        </AppText>
        <AppText variant="footnote" tone="secondary" style={{ textAlign: 'center' }}>
          Anyone with this code can join and add receipts to this budget.
        </AppText>
        <Button
          title="Share invite"
          icon="square.and.arrow.up"
          onPress={shareInvite}
          style={{ alignSelf: 'stretch' }}
        />
      </Card>

      <SectionHeader title="Budget" />
      <Card style={styles.list}>
        <Row label="Name" value={household.name} onPress={renameHousehold} />
        <Separator />
        <Row label="Currency" value={household.currency} onPress={chooseCurrency} />
      </Card>

      <SectionHeader title={`Members · ${members.length}`} />
      <Card style={styles.list}>
        {members.map((m, i) => (
          <View key={m.user_id}>
            {i > 0 ? <Separator inset={44} /> : null}
            <Pressable
              disabled={m.user_id !== userId}
              onPress={renameMe}
              style={({ pressed }) => [styles.member, { opacity: pressed ? 0.6 : 1 }]}>
              <View style={[styles.avatar, { backgroundColor: theme.fill }]}>
                <AppText variant="subhead" style={{ fontWeight: '600' }}>
                  {m.display_name.slice(0, 1).toUpperCase()}
                </AppText>
              </View>
              <AppText variant="body" style={{ flex: 1 }}>
                {m.display_name}
              </AppText>
              {m.user_id === userId ? (
                <AppText variant="subhead" tone="muted">
                  You · Edit
                </AppText>
              ) : null}
            </Pressable>
          </View>
        ))}
      </Card>

      <SectionHeader title="Account" />
      <Card style={styles.list}>
        <Row label="Signed in as" value={session?.user.email ?? ''} />
        <Separator />
        <Row label="Sign out" onPress={() => supabase.auth.signOut()} tone="accent" />
        <Separator />
        <Row label="Leave this budget" onPress={leave} tone="danger" />
      </Card>
    </Screen>
  );
}

function Row({
  label,
  value,
  onPress,
  tone = 'primary',
}: {
  label: string;
  value?: string;
  onPress?: () => void;
  tone?: 'primary' | 'accent' | 'danger';
}) {
  const theme = useTheme();
  return (
    <Pressable
      disabled={!onPress}
      onPress={onPress}
      accessibilityRole={onPress ? 'button' : undefined}
      style={({ pressed }) => [styles.row, { opacity: pressed ? 0.6 : 1 }]}>
      <AppText variant="body" tone={tone}>
        {label}
      </AppText>
      <View style={styles.rowValue}>
        {value ? (
          <AppText variant="body" tone="secondary" numberOfLines={1} style={{ flexShrink: 1 }}>
            {value}
          </AppText>
        ) : null}
        {onPress && tone === 'primary' ? (
          <Icon name="chevron.right" size={13} color={theme.textMuted} />
        ) : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  invite: { alignItems: 'center', gap: Spacing.sm, paddingVertical: Spacing.xl },
  code: { letterSpacing: 6, fontVariant: ['tabular-nums'] },
  list: { paddingVertical: Spacing.xs },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.lg,
    paddingVertical: 12,
  },
  rowValue: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, flexShrink: 1 },
  member: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, paddingVertical: 10 },
  avatar: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
});
