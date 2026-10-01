// Tells the rest of the household that someone added an expense.
// Called by the app right after it saves a receipt: { receipt_id }.

import { sendPush } from '../_shared/push.ts';
import {
  adminClient,
  categoryLabel,
  CORS_HEADERS,
  formatMoney,
  json,
  userClient,
} from '../_shared/supabase.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  const { data: userData, error: authError } = await userClient(req).auth.getUser();
  if (authError || !userData.user) return json({ error: 'Not signed in' }, 401);
  const user = userData.user;

  const body = await req.json().catch(() => ({}));
  const receiptId = typeof body.receipt_id === 'string' ? body.receipt_id : '';
  if (!receiptId) return json({ error: 'Missing receipt_id' }, 400);

  const admin = adminClient();
  const { data: receipt } = await admin
    .from('receipts')
    .select('id, household_id, created_by, merchant, total, category')
    .eq('id', receiptId)
    .maybeSingle();
  // Only the person who added a receipt can announce it.
  if (!receipt || receipt.created_by !== user.id) return json({ error: 'Receipt not found' }, 404);

  const [{ data: household }, { data: members }] = await Promise.all([
    admin.from('households').select('currency').eq('id', receipt.household_id).single(),
    admin.from('household_members').select('user_id, display_name').eq('household_id', receipt.household_id),
  ]);
  const author = members?.find((m) => m.user_id === user.id)?.display_name ?? 'Someone';
  const others = (members ?? []).filter((m) => m.user_id !== user.id).map((m) => m.user_id);
  if (others.length === 0) return json({ sent: 0 });

  const { data: subscriptions } = await admin
    .from('push_subscriptions')
    .select('id, endpoint, p256dh, auth')
    .in('user_id', others)
    .eq('new_expenses', true);

  try {
    const sent = await sendPush(admin, subscriptions ?? [], {
      title: `${author} added an expense`,
      body: [
        receipt.merchant,
        formatMoney(Number(receipt.total), household?.currency ?? 'USD'),
        categoryLabel(receipt.category),
      ].join(' · '),
      url: `/receipt/${receipt.id}`,
      tag: `receipt-${receipt.id}`,
    });
    return json({ sent });
  } catch (e) {
    console.error('notify-receipt failed', e);
    return json({ error: e instanceof Error ? e.message : 'Could not send notifications' }, 500);
  }
});
