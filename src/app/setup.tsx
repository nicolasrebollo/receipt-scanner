import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppText, Button, Screen, Segmented, TextField } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { supabase } from '@/lib/supabase';
import { useApp } from '@/providers/app-provider';
import { useNotifications } from '@/providers/notifications-provider';

type Mode = 'create' | 'join';

export default function SetupScreen() {
  const { refreshHousehold } = useApp();
  const { signOut } = useNotifications();
  const [mode, setMode] = useState<Mode>('create');
  const [yourName, setYourName] = useState('');
  const [householdName, setHouseholdName] = useState('Our budget');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setBusy(true);
    setError(null);
    const { error } =
      mode === 'create'
        ? await supabase.rpc('create_household', { household_name: householdName, member_name: yourName })
        : await supabase.rpc('join_household', { code, member_name: yourName });
    if (error) {
      setError(error.message);
      setBusy(false);
      return;
    }
    await refreshHousehold(); // the root layout moves on once the household loads
  };

  const canSubmit =
    yourName.trim().length > 0 &&
    (mode === 'create' ? householdName.trim().length > 0 : code.trim().length === 6);

  return (
    <Screen contentStyle={styles.content}>
      <View style={{ gap: Spacing.sm, marginBottom: Spacing.lg }}>
        <AppText variant="largeTitle">Set up your budget</AppText>
        <AppText variant="body" tone="secondary">
          Start a new household budget, or join one with the invite code from your partner’s app.
        </AppText>
      </View>

      <TextField
        label="Your name"
        placeholder="How others will see you"
        value={yourName}
        onChangeText={setYourName}
        autoCapitalize="words"
        textContentType="givenName"
        maxLength={40}
      />

      <Segmented
        options={[
          { value: 'create', label: 'Start new' },
          { value: 'join', label: 'Join with code' },
        ]}
        value={mode}
        onChange={setMode}
      />

      {mode === 'create' ? (
        <TextField label="Budget name" value={householdName} onChangeText={setHouseholdName} maxLength={60} />
      ) : (
        <TextField
          label="Invite code"
          placeholder="ABC123"
          value={code}
          onChangeText={(t) => setCode(t.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
          autoCapitalize="characters"
          autoCorrect={false}
          maxLength={6}
          style={{ letterSpacing: 4, fontWeight: '600' }}
        />
      )}

      {error ? (
        <AppText variant="footnote" tone="danger" style={{ textAlign: 'center' }}>
          {error}
        </AppText>
      ) : null}

      <Button
        title={mode === 'create' ? 'Create budget' : 'Join budget'}
        onPress={submit}
        loading={busy}
        disabled={!canSubmit}
      />
      <Button title="Sign out" variant="plain" onPress={signOut} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingTop: 72, gap: Spacing.md },
});
