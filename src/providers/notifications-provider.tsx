import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';

import { showMessage } from '@/lib/dialogs';
import {
  disablePush,
  enablePush,
  getPushStatus,
  pushSupport,
  setPushPrefs,
  type PushPrefs,
  type PushStatus,
  type PushSupport,
} from '@/lib/push';
import { supabase } from '@/lib/supabase';
import { useApp } from '@/providers/app-provider';

type NotificationsContextValue = {
  /** Whether this device can receive notifications at all. */
  support: PushSupport;
  /** Null until we've checked this device's state. */
  status: PushStatus | null;
  busy: boolean;
  /** True when we should ask the person whether they want notifications. */
  shouldPrompt: boolean;
  enable: () => Promise<void>;
  disable: () => Promise<void>;
  setPrefs: (prefs: PushPrefs) => Promise<void>;
  dismissPrompt: () => void;
  /** Signs out, first detaching this device so it stops getting this account's notifications. */
  signOut: () => Promise<void>;
};

const NotificationsContext = createContext<NotificationsContextValue | null>(null);

type Loaded = { userId: string; status: PushStatus; dismissed: boolean };

const dismissedKey = (userId: string) => `notifications-prompt-dismissed:${userId}`;

export function NotificationsProvider({ children }: { children: ReactNode }) {
  const { session, household } = useApp();
  const userId = session?.user.id ?? null;
  const ready = !!userId && !!household;
  const [support] = useState(pushSupport);
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!ready || !userId || support !== 'supported') return;
    let cancelled = false;
    Promise.all([getPushStatus(), AsyncStorage.getItem(dismissedKey(userId))]).then(
      ([status, dismissed]) => !cancelled && setLoaded({ userId, status, dismissed: dismissed !== null }),
      (e) => console.warn('Checking notification status failed', e),
    );
    return () => {
      cancelled = true;
    };
  }, [ready, userId, support]);

  // Ignore state left over from a previous account.
  const current = loaded && loaded.userId === userId ? loaded : null;

  const rememberDismissed = useCallback(() => {
    if (!userId) return;
    AsyncStorage.setItem(dismissedKey(userId), '1').catch(() => {});
    setLoaded((prev) => (prev ? { ...prev, dismissed: true } : prev));
  }, [userId]);

  const enable = useCallback(async () => {
    if (!userId) return;
    setBusy(true);
    try {
      const status = await enablePush();
      setLoaded((prev) => ({ userId, status, dismissed: prev?.dismissed ?? false }));
      if (status.permission === 'denied') {
        showMessage(
          'Notifications are blocked',
          'To allow them, open your iPhone’s Settings, tap Notifications, then Receipts.',
        );
      }
    } catch (e) {
      console.warn('Enabling notifications failed', e);
      showMessage('Couldn’t turn on notifications', 'Check your connection and try again.');
    } finally {
      setBusy(false);
    }
  }, [userId]);

  const disable = useCallback(async () => {
    setBusy(true);
    try {
      await disablePush();
      setLoaded((prev) => (prev ? { ...prev, status: { ...prev.status, enabled: false } } : prev));
      rememberDismissed(); // they've made their choice; don't ask again on the home screen
    } catch (e) {
      console.warn('Disabling notifications failed', e);
      showMessage('Couldn’t turn off notifications', 'Check your connection and try again.');
    } finally {
      setBusy(false);
    }
  }, [rememberDismissed]);

  const setPrefs = useCallback(async (prefs: PushPrefs) => {
    let previous: PushStatus | undefined;
    setLoaded((prev) => {
      previous = prev?.status;
      return prev ? { ...prev, status: { ...prev.status, ...prefs } } : prev;
    });
    try {
      await setPushPrefs(prefs);
    } catch (e) {
      console.warn('Saving notification settings failed', e);
      setLoaded((prev) => (prev && previous ? { ...prev, status: previous } : prev));
      showMessage('Couldn’t save', 'Check your connection and try again.');
    }
  }, []);

  const signOut = useCallback(async () => {
    await disablePush().catch((e) => console.warn('Detaching device failed', e));
    await supabase.auth.signOut();
  }, []);

  const status = current?.status ?? null;
  return (
    <NotificationsContext.Provider
      value={{
        support,
        status,
        busy,
        shouldPrompt:
          support === 'supported' &&
          !!current &&
          !current.dismissed &&
          !current.status.enabled &&
          current.status.permission !== 'denied',
        enable,
        disable,
        setPrefs,
        dismissPrompt: rememberDismissed,
        signOut,
      }}>
      {children}
    </NotificationsContext.Provider>
  );
}

export function useNotifications() {
  const ctx = useContext(NotificationsContext);
  if (!ctx) throw new Error('useNotifications must be used inside NotificationsProvider');
  return ctx;
}
