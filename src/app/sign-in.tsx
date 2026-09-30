import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppText, Button, Icon, Screen, Segmented, TextField } from '@/components/ui';
import { Spacing, useTheme } from '@/constants/theme';
import { supabase } from '@/lib/supabase';

type Mode = 'sign-in' | 'sign-up';

export default function SignInScreen() {
  const theme = useTheme();
  const [mode, setMode] = useState<Mode>('sign-in');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: 'danger' | 'secondary'; text: string } | null>(null);

  const submit = async () => {
    setBusy(true);
    setMessage(null);
    const credentials = { email: email.trim(), password };
    if (mode === 'sign-in') {
      const { error } = await supabase.auth.signInWithPassword(credentials);
      if (error) setMessage({ tone: 'danger', text: error.message });
    } else {
      const { data, error } = await supabase.auth.signUp(credentials);
      if (error) setMessage({ tone: 'danger', text: error.message });
      else if (!data.session) {
        setMessage({ tone: 'secondary', text: 'Check your email to confirm your account, then sign in.' });
        setMode('sign-in');
      }
    }
    setBusy(false);
  };

  const canSubmit = email.includes('@') && password.length >= 6;

  return (
    <Screen contentStyle={styles.content}>
      <View style={styles.brand}>
        <View style={[styles.logo, { backgroundColor: theme.accent }]}>
          <Icon name="doc.text.viewfinder" size={34} color={theme.accentText} />
        </View>
        <AppText variant="largeTitle">Receipts</AppText>
        <AppText variant="body" tone="secondary" style={{ textAlign: 'center' }}>
          Snap a receipt. We’ll read it, sort it, and add it to your shared budget.
        </AppText>
      </View>

      <Segmented
        options={[
          { value: 'sign-in', label: 'Sign in' },
          { value: 'sign-up', label: 'Create account' },
        ]}
        value={mode}
        onChange={setMode}
      />

      <TextField
        placeholder="Email"
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        autoComplete="email"
        keyboardType="email-address"
        textContentType="emailAddress"
      />
      <TextField
        placeholder={mode === 'sign-up' ? 'Password (6+ characters)' : 'Password'}
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        autoComplete={mode === 'sign-up' ? 'new-password' : 'current-password'}
        textContentType={mode === 'sign-up' ? 'newPassword' : 'password'}
        onSubmitEditing={canSubmit ? submit : undefined}
      />

      {message ? (
        <AppText variant="footnote" tone={message.tone} style={{ textAlign: 'center' }}>
          {message.text}
        </AppText>
      ) : null}

      <Button
        title={mode === 'sign-in' ? 'Sign in' : 'Create account'}
        onPress={submit}
        loading={busy}
        disabled={!canSubmit}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingTop: 72, gap: Spacing.md },
  brand: { alignItems: 'center', gap: Spacing.sm, marginBottom: Spacing.xl, paddingHorizontal: Spacing.lg },
  logo: {
    width: 72,
    height: 72,
    borderRadius: 20,
    borderCurve: 'continuous',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.sm,
  },
});
