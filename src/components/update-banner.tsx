import { useEffect, useState } from 'react';
import { AppState, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText, Icon } from '@/components/ui';
import { Radius, Spacing, useTheme } from '@/constants/theme';
import { applyUpdate, isUpdateAvailable } from '@/lib/app-update';

/** Offers to reload when a newer version of the web app has been published. */
export function UpdateBanner() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const [available, setAvailable] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const check = () => isUpdateAvailable().then((yes) => !cancelled && yes && setAvailable(true));
    check();
    // Check again whenever the app comes back to the foreground.
    const sub = AppState.addEventListener('change', (state) => state === 'active' && check());
    return () => {
      cancelled = true;
      sub.remove();
    };
  }, []);

  if (!available) return null;
  return (
    <View pointerEvents="box-none" style={[styles.wrap, { top: insets.top + Spacing.sm }]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="A new version is available. Tap to update."
        onPress={applyUpdate}
        style={({ pressed }) => [
          styles.banner,
          { backgroundColor: theme.text, opacity: pressed ? 0.85 : 1 },
        ]}>
        <Icon name="arrow.triangle.2.circlepath" size={16} color={theme.background} weight="semibold" />
        <AppText variant="subhead" style={{ color: theme.background, flex: 1, fontWeight: '600' }}>
          New version available
        </AppText>
        <AppText variant="subhead" style={{ color: theme.background, fontWeight: '700' }}>
          Update
        </AppText>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: Spacing.lg, right: Spacing.lg, zIndex: 1000 },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderRadius: Radius.md,
    borderCurve: 'continuous',
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
  },
});
