// Sends each household its "monthly summary is ready" notification.
// Run by a database cron job on the 1st of every month (see supabase/monthly-cron.sql).
// Deployed without JWT verification; the cron job proves itself with the CRON_SECRET header instead.

import { sendPush, type SubscriptionRow } from '../_shared/push.ts';
import { adminClient, categoryLabel, formatMoney, json } from '../_shared/supabase.ts';

/** The calendar month before `now`, as "YYYY-MM". */
function previousMonth(now: Date): string {
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
  return d.toISOString().slice(0, 7);
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  const secret = Deno.env.get('CRON_SECRET');
  if (!secret || req.headers.get('x-cron-secret') !== secret) return json({ error: 'Unauthorized' }, 401);

  // { "month": "2026-09" } overrides the month, which is handy for a test run.
  const body = await req.json().catch(() => ({}));
  const month = /^\d{4}-(0[1-9]|1[0-2])$/.test(body.month)
    ? (body.month as string)
    : previousMonth(new Date());
  const [year, monthNumber] = month.split('-').map(Number);
  const start = `${month}-01`;
  const end = new Date(Date.UTC(year, monthNumber, 0)).toISOString().slice(0, 10);
  const monthName = new Date(Date.UTC(year, monthNumber - 1, 1)).toLocaleDateString('en-US', {
    month: 'long',
    timeZone: 'UTC',
  });

  const admin = adminClient();
  const { data: subscriptions, error } = await admin
    .from('push_subscriptions')
    .select('id, user_id, endpoint, p256dh, auth')
    .eq('monthly_summary', true);
  if (error) return json({ error: error.message }, 500);
  if (!subscriptions?.length) return json({ month, households: 0, sent: 0 });

  const userIds = [...new Set(subscriptions.map((s) => s.user_id as string))];
  const { data: memberships } = await admin
    .from('household_members')
    .select('user_id, household_id')
    .in('user_id', userIds);

  // household id -> devices that want its summary
  const devices = new Map<string, SubscriptionRow[]>();
  for (const m of memberships ?? []) {
    const list = devices.get(m.household_id) ?? [];
    list.push(...subscriptions.filter((s) => s.user_id === m.user_id));
    devices.set(m.household_id, list);
  }

  let sent = 0;
  let households = 0;
  try {
    for (const [householdId, householdDevices] of devices) {
      const [{ data: household }, { data: receipts }] = await Promise.all([
        admin.from('households').select('currency').eq('id', householdId).single(),
        admin
          .from('receipts')
          .select('total, category')
          .eq('household_id', householdId)
          .gte('purchased_on', start)
          .lte('purchased_on', end),
      ]);
      // Nothing to summarize; stay quiet rather than ping about an empty month.
      if (!receipts?.length) continue;

      const total = receipts.reduce((sum, r) => sum + Number(r.total), 0);
      const byCategory = new Map<string, number>();
      for (const r of receipts)
        byCategory.set(r.category, (byCategory.get(r.category) ?? 0) + Number(r.total));
      const [topCategory] = [...byCategory.entries()].sort((a, b) => b[1] - a[1])[0];
      const count = receipts.length === 1 ? '1 receipt' : `${receipts.length} receipts`;

      households++;
      sent += await sendPush(admin, householdDevices, {
        title: `Your ${monthName} summary is ready`,
        body: `${formatMoney(total, household?.currency ?? 'USD')} across ${count}. Top category: ${categoryLabel(topCategory)}.`,
        url: `/insights?month=${month}`,
        tag: `summary-${month}`,
      });
    }
  } catch (e) {
    console.error('monthly-summary failed', e);
    return json({ error: e instanceof Error ? e.message : 'Could not send summaries' }, 500);
  }

  return json({ month, households, sent });
});
