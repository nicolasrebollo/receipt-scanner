-- AI chat: conversations, their messages, and things the assistant has been asked to remember.
-- Purely additive and safe to run twice: no existing table or row is changed.
--
-- Chats and memories are private to the person who created them. What the assistant can read
-- about receipts is decided by the existing receipts policies, because the chat function
-- queries the database as the signed-in user.

create table if not exists public.chat_conversations (
  id           uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  user_id      uuid not null default auth.uid() references auth.users (id) on delete cascade,
  title        text not null check (char_length(title) between 1 and 120),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists chat_conversations_recent
  on public.chat_conversations (user_id, household_id, updated_at desc);

create table if not exists public.chat_messages (
  id              uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.chat_conversations (id) on delete cascade,
  role            text not null check (role in ('user', 'assistant')),
  content         text not null,
  created_at      timestamptz not null default now()
);

create index if not exists chat_messages_by_conversation
  on public.chat_messages (conversation_id, created_at);

create table if not exists public.chat_memories (
  id           uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  user_id      uuid not null default auth.uid() references auth.users (id) on delete cascade,
  content      text not null check (char_length(content) between 1 and 300),
  created_at   timestamptz not null default now()
);

create index if not exists chat_memories_by_user on public.chat_memories (user_id, household_id, created_at);

alter table public.chat_conversations enable row level security;
alter table public.chat_messages enable row level security;
alter table public.chat_memories enable row level security;

-- Conversations: only the owner, and only inside a household they belong to.
drop policy if exists "owners read their conversations" on public.chat_conversations;
create policy "owners read their conversations" on public.chat_conversations
  for select to authenticated using (user_id = auth.uid());

drop policy if exists "owners start conversations" on public.chat_conversations;
create policy "owners start conversations" on public.chat_conversations
  for insert to authenticated
  with check (user_id = auth.uid() and public.is_household_member(household_id));

drop policy if exists "owners update their conversations" on public.chat_conversations;
create policy "owners update their conversations" on public.chat_conversations
  for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "owners delete their conversations" on public.chat_conversations;
create policy "owners delete their conversations" on public.chat_conversations
  for delete to authenticated using (user_id = auth.uid());

-- Messages: readable and writable only through a conversation the person owns.
drop policy if exists "owners read their messages" on public.chat_messages;
create policy "owners read their messages" on public.chat_messages
  for select to authenticated
  using (exists (
    select 1 from public.chat_conversations c
    where c.id = conversation_id and c.user_id = auth.uid()
  ));

drop policy if exists "owners add messages" on public.chat_messages;
create policy "owners add messages" on public.chat_messages
  for insert to authenticated
  with check (exists (
    select 1 from public.chat_conversations c
    where c.id = conversation_id and c.user_id = auth.uid()
  ));

-- Memories: only the owner.
drop policy if exists "owners read their memories" on public.chat_memories;
create policy "owners read their memories" on public.chat_memories
  for select to authenticated using (user_id = auth.uid());

drop policy if exists "owners add memories" on public.chat_memories;
create policy "owners add memories" on public.chat_memories
  for insert to authenticated
  with check (user_id = auth.uid() and public.is_household_member(household_id));

drop policy if exists "owners delete their memories" on public.chat_memories;
create policy "owners delete their memories" on public.chat_memories
  for delete to authenticated using (user_id = auth.uid());
