import type { SFSymbol } from 'expo-symbols';
import { TabList, TabSlot, Tabs, TabTrigger, type TabTriggerSlotProps } from 'expo-router/ui';
import { forwardRef } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon } from '@/components/ui';
import { useTheme } from '@/constants/theme';

const TABS = [
  { name: 'index', href: '/', label: 'Scan', icon: 'doc.text.viewfinder' },
  { name: 'history', href: '/history', label: 'History', icon: 'list.bullet' },
  { name: 'insights', href: '/insights', label: 'Insights', icon: 'chart.bar' },
  { name: 'chat', href: '/chat', label: 'Chat', icon: 'bubble.left.and.bubble.right' },
  { name: 'settings', href: '/settings', label: 'Household', icon: 'person.2' },
] as const;

/** Browser tab bar, styled like the iOS one. */
export function AppTabs() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <Tabs style={{ flex: 1 }}>
      <TabSlot style={{ flex: 1 }} />
      <TabList
        style={[
          styles.bar,
          {
            backgroundColor: theme.card,
            borderTopColor: theme.separator,
            paddingBottom: Math.max(insets.bottom, 8),
          },
        ]}>
        {TABS.map((t) => (
          <TabTrigger key={t.name} name={t.name} href={t.href} asChild>
            <TabButton label={t.label} icon={t.icon} />
          </TabTrigger>
        ))}
      </TabList>
    </Tabs>
  );
}

const TabButton = forwardRef<View, TabTriggerSlotProps & { label: string; icon: SFSymbol }>(
  function TabButton({ label, icon, isFocused, ...props }, ref) {
    const theme = useTheme();
    const color = isFocused ? theme.accent : theme.textMuted;
    return (
      <Pressable ref={ref} {...props} style={styles.button}>
        <Icon name={icon} size={24} color={color} />
        <Text style={[styles.label, { color }]}>{label}</Text>
      </Pressable>
    );
  },
);

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: 6,
  },
  button: { flex: 1, alignItems: 'center', gap: 2, paddingVertical: 2 },
  label: { fontSize: 10, fontWeight: '500' },
});
