-- Receipt scanner schema: households share one budget; receipts belong to a household.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table public.households (
  id          uuid primary key default gen_random_uuid(),
  name        text not null check (char_length(name) between 1 and 60),
  currency    text not null default 'USD' check (char_length(currency) = 3),
  invite_code text not null unique
              default upper(substr(encode(gen_random_bytes(6), 'hex'), 1, 6)),
  created_at  timestamptz not null default now()
);

create table public.household_members (
  household_id uuid not null references public.households (id) on delete cascade,
  user_id      uuid not null references auth.users (id) on delete cascade,
  display_name text not null check (char_length(display_name) between 1 and 40),
  joined_at    timestamptz not null default now(),
  primary key (household_id, user_id)
);

-- One household per user keeps the app simple.
create unique index household_members_one_per_user on public.household_members (user_id);

create table public.receipts (
  id           uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  created_by   uuid default auth.uid() references auth.users (id) on delete set null,
  merchant     text not null check (char_length(merchant) between 1 and 120),
  total        numeric(12, 2) not null check (total >= 0),
  purchased_on date not null,
  category     text not null check (category in (
                 'groceries', 'dining', 'transport', 'shopping', 'household',
                 'health', 'entertainment', 'utilities', 'travel', 'other')),
  notes        text check (char_length(notes) <= 500),
  image_path   text,
  created_at   timestamptz not null default now()
);

create index receipts_household_date on public.receipts (household_id, purchased_on desc);

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

-- security definer so policies on household_members can call it without recursion.
create function public.is_household_member(hid uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.household_members
    where household_id = hid and user_id = auth.uid()
  );
$$;

-- Storage paths start with the household id; compare as text so odd paths never error.
create function public.can_access_receipt_folder(object_name text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.household_members
    where household_id::text = (storage.foldername(object_name))[1]
      and user_id = auth.uid()
  );
$$;

create function public.create_household(household_name text, member_name text)
returns public.households
language plpgsql
security definer
set search_path = ''
as $$
declare
  h public.households;
begin
  if auth.uid() is null then
    raise exception 'Not signed in';
  end if;
  if exists (select 1 from public.household_members where user_id = auth.uid()) then
    raise exception 'You''re already in a household';
  end if;
  insert into public.households (name) values (trim(household_name)) returning * into h;
  insert into public.household_members (household_id, user_id, display_name)
    values (h.id, auth.uid(), trim(member_name));
  return h;
end;
$$;

create function public.join_household(code text, member_name text)
returns public.households
language plpgsql
security definer
set search_path = ''
as $$
declare
  h public.households;
begin
  if auth.uid() is null then
    raise exception 'Not signed in';
  end if;
  if exists (select 1 from public.household_members where user_id = auth.uid()) then
    raise exception 'You''re already in a household';
  end if;
  select * into h from public.households where invite_code = upper(trim(code));
  if h.id is null then
    raise exception 'No household found for that code';
  end if;
  insert into public.household_members (household_id, user_id, display_name)
    values (h.id, auth.uid(), trim(member_name));
  return h;
end;
$$;

create function public.leave_household()
returns void
language sql
security definer
set search_path = ''
as $$
  delete from public.household_members where user_id = auth.uid();
$$;

revoke execute on function public.create_household, public.join_household, public.leave_household
  from public, anon;
grant execute on function public.create_household, public.join_household, public.leave_household
  to authenticated;

-- ---------------------------------------------------------------------------
-- Row level security
-- ---------------------------------------------------------------------------

alter table public.households enable row level security;
alter table public.household_members enable row level security;
alter table public.receipts enable row level security;

create policy "members read their household" on public.households
  for select to authenticated using (public.is_household_member(id));

create policy "members rename their household" on public.households
  for update to authenticated
  using (public.is_household_member(id)) with check (public.is_household_member(id));

create policy "members see each other" on public.household_members
  for select to authenticated using (public.is_household_member(household_id));

create policy "members edit their own profile" on public.household_members
  for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "members read receipts" on public.receipts
  for select to authenticated using (public.is_household_member(household_id));

create policy "members add receipts" on public.receipts
  for insert to authenticated
  with check (public.is_household_member(household_id) and created_by = auth.uid());

create policy "members edit receipts" on public.receipts
  for update to authenticated
  using (public.is_household_member(household_id))
  with check (public.is_household_member(household_id));

create policy "members delete receipts" on public.receipts
  for delete to authenticated using (public.is_household_member(household_id));

-- Push receipt changes to other household members in real time.
alter publication supabase_realtime add table public.receipts;

-- ---------------------------------------------------------------------------
-- Receipt photo storage: receipts/<household_id>/<file>.jpg
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public) values ('receipts', 'receipts', false)
on conflict (id) do nothing;

create policy "members read receipt photos" on storage.objects
  for select to authenticated
  using (bucket_id = 'receipts'
         and public.can_access_receipt_folder(name));

create policy "members upload receipt photos" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'receipts'
              and public.can_access_receipt_folder(name));

create policy "members delete receipt photos" on storage.objects
  for delete to authenticated
  using (bucket_id = 'receipts'
         and public.can_access_receipt_folder(name));
