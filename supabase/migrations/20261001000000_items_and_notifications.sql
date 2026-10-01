-- Itemized lists on receipts, and push-notification subscriptions.
-- Purely additive: existing rows are kept as they are (old receipts simply get an empty item list).

-- ---------------------------------------------------------------------------
-- Itemized list: [{ "name": "Bananas", "price": 1.29 }, ...]
-- ---------------------------------------------------------------------------

alter table public.receipts
  add column if not exists items jsonb not null default '[]'::jsonb;

alter table public.receipts
  drop constraint if exists receipts_items_is_array;
alter table public.receipts
  add constraint receipts_items_is_array check (jsonb_typeof(items) = 'array');

-- ---------------------------------------------------------------------------
-- Push subscriptions: one row per device that has turned notifications on.
-- ---------------------------------------------------------------------------

create table if not exists public.push_subscriptions (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null default auth.uid() references auth.users (id) on delete cascade,
  endpoint        text not null unique,
  p256dh          text not null,
  auth            text not null,
  new_expenses    boolean not null default true,
  monthly_summary boolean not null default true,
  created_at      timestamptz not null default now()
);

create index if not exists push_subscriptions_user on public.push_subscriptions (user_id);

alter table public.push_subscriptions enable row level security;

-- People can see and change only their own devices. The server functions that send
-- notifications use the service role, which bypasses these policies.
drop policy if exists "users read their own subscriptions" on public.push_subscriptions;
create policy "users read their own subscriptions" on public.push_subscriptions
  for select to authenticated using (user_id = auth.uid());

drop policy if exists "users update their own subscriptions" on public.push_subscriptions;
create policy "users update their own subscriptions" on public.push_subscriptions
  for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "users delete their own subscriptions" on public.push_subscriptions;
create policy "users delete their own subscriptions" on public.push_subscriptions
  for delete to authenticated using (user_id = auth.uid());

-- Registers this device for the signed-in user. A device has one endpoint, so if someone
-- else was signed in on it before, their row is replaced (hence security definer).
create or replace function public.save_push_subscription(p_endpoint text, p_p256dh text, p_auth text)
returns public.push_subscriptions
language plpgsql
security definer
set search_path = ''
as $$
declare
  s public.push_subscriptions;
begin
  if auth.uid() is null then
    raise exception 'Not signed in';
  end if;
  delete from public.push_subscriptions where endpoint = p_endpoint and user_id <> auth.uid();
  insert into public.push_subscriptions (user_id, endpoint, p256dh, auth)
    values (auth.uid(), p_endpoint, p_p256dh, p_auth)
  on conflict (endpoint) do update set p256dh = excluded.p256dh, auth = excluded.auth
  returning * into s;
  return s;
end;
$$;

revoke execute on function public.save_push_subscription from public, anon;
grant execute on function public.save_push_subscription to authenticated;
