import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { useColorScheme } from 'react-native';

import { Colors } from '@/constants/theme';
import { AppProvider, useApp } from '@/providers/app-provider';
import { ChatProvider } from '@/providers/chat-provider';
import { NotificationsProvider } from '@/providers/notifications-provider';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const scheme = useColorScheme();
  const base = scheme === 'dark' ? DarkTheme : DefaultTheme;
  const colors = scheme === 'dark' ? Colors.dark : Colors.light;
  return (
    <ThemeProvider
      value={{
        ...base,
        colors: { ...base.colors, primary: colors.accent, background: colors.background, card: colors.card },
      }}>
      <AppProvider>
        <NotificationsProvider>
          <ChatProvider>
            <RootNavigator />
          </ChatProvider>
        </NotificationsProvider>
      </AppProvider>
    </ThemeProvider>
  );
}

function RootNavigator() {
  const { session, household, initializing } = useApp();

  useEffect(() => {
    if (!initializing) SplashScreen.hideAsync();
  }, [initializing]);

  if (initializing) return null;

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Protected guard={!session}>
        <Stack.Screen name="sign-in" />
      </Stack.Protected>
      <Stack.Protected guard={!!session && !household}>
        <Stack.Screen name="setup" />
      </Stack.Protected>
      <Stack.Protected guard={!!session && !!household}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="review" options={{ presentation: 'modal', gestureEnabled: false }} />
        <Stack.Screen name="receipt/[id]" options={{ presentation: 'modal' }} />
        <Stack.Screen name="chat-history" options={{ presentation: 'modal' }} />
      </Stack.Protected>
    </Stack>
  );
}
