// Push notifications are delivered through the home-screen web app (see push.web.ts).
// This native version reports them as unavailable so the UI can explain that.

export type PushSupport = 'supported' | 'needs-install' | 'unsupported';

export type PushStatus = {
  permission: 'default' | 'granted' | 'denied';
  /** This device is registered to receive notifications for the signed-in user. */
  enabled: boolean;
  newExpenses: boolean;
  monthlySummary: boolean;
};

export type PushPrefs = Partial<Pick<PushStatus, 'newExpenses' | 'monthlySummary'>>;

const OFF: PushStatus = { permission: 'default', enabled: false, newExpenses: true, monthlySummary: true };

export function pushSupport(): PushSupport {
  return 'unsupported';
}

export async function getPushStatus(): Promise<PushStatus> {
  return OFF;
}

export async function enablePush(): Promise<PushStatus> {
  return OFF;
}

export async function disablePush(): Promise<void> {}

export async function setPushPrefs(_prefs: PushPrefs): Promise<void> {}

/** Path from a notification that launched the app, if any. */
export function initialNotificationPath(): string | null {
  return null;
}

/** Calls `handler` when a notification is tapped while the app is open. Returns an unsubscribe function. */
export function onNotificationOpened(_handler: (path: string) => void): () => void {
  return () => {};
}
