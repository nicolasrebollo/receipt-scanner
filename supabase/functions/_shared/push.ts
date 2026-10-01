// Sends Web Push notifications (the kind a home-screen web app receives on iPhone).

import * as webpush from 'jsr:@negrel/webpush@0.5.0';
import type { SupabaseClient } from 'npm:@supabase/supabase-js@2';

export type PushPayload = {
  title: string;
  body: string;
  /** Path the app opens when the notification is tapped, e.g. "/receipt/<id>". */
  url: string;
  /** Notifications with the same tag replace each other instead of stacking. */
  tag?: string;
};

export type SubscriptionRow = { id: string; endpoint: string; p256dh: string; auth: string };

let appServer: Promise<webpush.ApplicationServer> | undefined;

function getAppServer() {
  appServer ??= (async () => {
    const raw = Deno.env.get('VAPID_KEYS');
    if (!raw) throw new Error('The VAPID_KEYS secret is not set');
    const vapidKeys = await webpush.importVapidKeys(JSON.parse(raw), { extractable: false });
    return webpush.ApplicationServer.new({
      // Push services ask for a way to identify the sender; the project URL does that.
      contactInformation: Deno.env.get('SUPABASE_URL')!,
      vapidKeys,
    });
  })();
  return appServer;
}

/** Sends the payload to each device and returns how many were delivered to the push service. */
export async function sendPush(
  admin: SupabaseClient,
  subscriptions: SubscriptionRow[],
  payload: PushPayload,
): Promise<number> {
  if (subscriptions.length === 0) return 0;
  const server = await getAppServer();
  const message = JSON.stringify(payload);
  const gone: string[] = [];
  let sent = 0;

  await Promise.all(
    subscriptions.map(async (s) => {
      try {
        await server
          .subscribe({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } })
          .pushTextMessage(message, { ttl: 3 * 24 * 60 * 60 });
        sent++;
      } catch (e) {
        if (e instanceof webpush.PushMessageError) {
          // The device unsubscribed or the app was removed; forget it.
          if (e.isGone()) gone.push(s.id);
          else console.error('Push rejected', e.response.status, await e.response.text());
        } else {
          console.error('Push failed', e);
        }
      }
    }),
  );

  if (gone.length > 0) await admin.from('push_subscriptions').delete().in('id', gone);
  return sent;
}
