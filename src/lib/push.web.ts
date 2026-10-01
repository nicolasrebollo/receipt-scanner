// Web Push for the home-screen web app. On iPhone this only works once the site has been
// added to the Home Screen; in a regular Safari tab the push APIs don't exist.

import { supabase } from '@/lib/supabase';

import type { PushPrefs, PushStatus, PushSupport } from './push';

export type { PushPrefs, PushStatus, PushSupport } from './push';

const VAPID_PUBLIC_KEY = process.env.EXPO_PUBLIC_VAPID_PUBLIC_KEY;

export function pushSupport(): PushSupport {
  if (!VAPID_PUBLIC_KEY || typeof window === 'undefined') return 'unsupported';
  if ('serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window) return 'supported';
  return /iPhone|iPad|iPod/.test(navigator.userAgent) ? 'needs-install' : 'unsupported';
}

function off(): PushStatus {
  return { permission: Notification.permission, enabled: false, newExpenses: true, monthlySummary: true };
}

function base64UrlToBytes(value: string): Uint8Array<ArrayBuffer> {
  const base64 = value
    .replace(/-/g, '+')
    .replace(/_/g, '/')
    .padEnd(Math.ceil(value.length / 4) * 4, '=');
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

export async function getPushStatus(): Promise<PushStatus> {
  if (pushSupport() !== 'supported' || Notification.permission !== 'granted') return off();
  // Re-registering is a no-op when nothing changed, and picks up a new sw.js when it has.
  const registration = await navigator.serviceWorker.register('/sw.js');
  const subscription = await registration.pushManager.getSubscription();
  if (!subscription) return off();
  const { data } = await supabase
    .from('push_subscriptions')
    .select('new_expenses, monthly_summary')
    .eq('endpoint', subscription.endpoint)
    .maybeSingle();
  if (!data) return off();
  return {
    permission: 'granted',
    enabled: true,
    newExpenses: data.new_expenses,
    monthlySummary: data.monthly_summary,
  };
}

/** Asks for permission and registers this device. Must be called directly from a tap. */
export async function enablePush(): Promise<PushStatus> {
  // Keep this the first await: iOS only shows the permission sheet in direct response to a tap.
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') return off();

  const registration = await navigator.serviceWorker.register('/sw.js');
  await navigator.serviceWorker.ready;
  const subscription =
    (await registration.pushManager.getSubscription()) ??
    (await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: base64UrlToBytes(VAPID_PUBLIC_KEY!),
    }));

  const { endpoint, keys } = subscription.toJSON();
  const { data, error } = await supabase.rpc('save_push_subscription', {
    p_endpoint: endpoint,
    p_p256dh: keys?.p256dh,
    p_auth: keys?.auth,
  });
  if (error) throw error;
  return {
    permission: 'granted',
    enabled: true,
    newExpenses: data.new_expenses,
    monthlySummary: data.monthly_summary,
  };
}

export async function disablePush(): Promise<void> {
  if (pushSupport() !== 'supported') return;
  const registration = await navigator.serviceWorker.getRegistration();
  const subscription = await registration?.pushManager.getSubscription();
  if (!subscription) return;
  await supabase.from('push_subscriptions').delete().eq('endpoint', subscription.endpoint);
  await subscription.unsubscribe();
}

export async function setPushPrefs(prefs: PushPrefs): Promise<void> {
  const registration = await navigator.serviceWorker.getRegistration();
  const subscription = await registration?.pushManager.getSubscription();
  if (!subscription) return;
  const { error } = await supabase
    .from('push_subscriptions')
    .update({
      ...(prefs.newExpenses !== undefined ? { new_expenses: prefs.newExpenses } : {}),
      ...(prefs.monthlySummary !== undefined ? { monthly_summary: prefs.monthlySummary } : {}),
    })
    .eq('endpoint', subscription.endpoint);
  if (error) throw error;
}

/** Only in-app paths; anything else (a full URL, "//host") is ignored. */
function safePath(path: unknown): string | null {
  return typeof path === 'string' && path.startsWith('/') && !path.startsWith('//') ? path : null;
}

/** The sw.js opens the app at "/?open=<path>" when a notification is tapped while it's closed. */
export function initialNotificationPath(): string | null {
  const url = new URL(window.location.href);
  const path = safePath(url.searchParams.get('open'));
  if (url.searchParams.has('open')) {
    url.searchParams.delete('open');
    window.history.replaceState(null, '', url.pathname + url.search);
  }
  return path;
}

export function onNotificationOpened(handler: (path: string) => void): () => void {
  if (!('serviceWorker' in navigator)) return () => {};
  const listener = (event: MessageEvent) => {
    const path = event.data?.type === 'open' ? safePath(event.data.path) : null;
    if (path) handler(path);
  };
  navigator.serviceWorker.addEventListener('message', listener);
  return () => navigator.serviceWorker.removeEventListener('message', listener);
}
