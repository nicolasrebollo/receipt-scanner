import { StyleSheet, View } from 'react-native';

import { AppText, Button, Card, Icon } from '@/components/ui';
import { Spacing, useTheme } from '@/constants/theme';
import { useNotifications } from '@/providers/notifications-provider';

/** Asks once whether the person wants notifications. Renders nothing after they answer. */
export function NotificationPrompt() {
  const theme = useTheme();
  const { shouldPrompt, busy, enable, dismissPrompt } = useNotifications();
  if (!shouldPrompt) return null;

  return (
    <Card style={styles.card}>
      <View style={styles.heading}>
        <Icon name="bell" size={20} color={theme.accent} />
        <AppText variant="headline">Turn on notifications?</AppText>
      </View>
      <AppText variant="subhead" tone="secondary">
        Get a heads-up when someone in your household adds an expense, and when your monthly summary is ready.
        You can change this any time in the Household tab.
      </AppText>
      <View style={styles.buttons}>
        <Button
          title="Not now"
          variant="secondary"
          onPress={dismissPrompt}
          disabled={busy}
          style={styles.button}
        />
        <Button title="Turn on" onPress={enable} loading={busy} style={styles.button} />
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { gap: Spacing.md },
  heading: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  buttons: { flexDirection: 'row', gap: Spacing.md },
  button: { flex: 1, minHeight: 44 },
});
