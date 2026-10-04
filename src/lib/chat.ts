import { fetch } from 'expo/fetch';

import { today } from '@/lib/dates';
import { supabase, SUPABASE_KEY, SUPABASE_URL } from '@/lib/supabase';

export type Conversation = { id: string; title: string; updated_at: string };
export type ChatMessage = { id: string; role: 'user' | 'assistant'; content: string };
export type Memory = { id: string; content: string };

/** What the chat function streams back while it works on a reply. */
export type ChatEvent =
  | { type: 'conversation'; id: string; title: string }
  | { type: 'status'; label: string }
  | { type: 'delta'; text: string }
  | { type: 'error'; message: string }
  | { type: 'done' };

export async function listConversations(householdId: string): Promise<Conversation[]> {
  const { data, error } = await supabase
    .from('chat_conversations')
    .select('id, title, updated_at')
    .eq('household_id', householdId)
    .order('updated_at', { ascending: false })
    .limit(200);
  if (error) throw error;
  return data;
}

export async function getMessages(conversationId: string): Promise<ChatMessage[]> {
  const { data, error } = await supabase
    .from('chat_messages')
    .select('id, role, content')
    .eq('conversation_id', conversationId)
    .order('created_at');
  if (error) throw error;
  return data as ChatMessage[];
}

export async function deleteConversation(id: string): Promise<void> {
  const { error } = await supabase.from('chat_conversations').delete().eq('id', id);
  if (error) throw error;
}

export async function listMemories(householdId: string): Promise<Memory[]> {
  const { data, error } = await supabase
    .from('chat_memories')
    .select('id, content')
    .eq('household_id', householdId)
    .order('created_at');
  if (error) throw error;
  return data;
}

export async function deleteMemory(id: string): Promise<void> {
  const { error } = await supabase.from('chat_memories').delete().eq('id', id);
  if (error) throw error;
}

/**
 * Sends one message and reports the reply as it streams in. Resolves when the reply is
 * complete; rejects if the request fails, the assistant reports an error, or the stream is cut off.
 */
export async function sendChatMessage(opts: {
  conversationId: string | null;
  message: string;
  signal: AbortSignal;
  onEvent: (event: ChatEvent) => void;
}): Promise<void> {
  const { data } = await supabase.auth.getSession();
  const response = await fetch(`${SUPABASE_URL}/functions/v1/chat`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${data.session?.access_token ?? ''}`,
    },
    body: JSON.stringify({ conversation_id: opts.conversationId, message: opts.message, today: today() }),
    signal: opts.signal,
  });

  if (!response.ok || !response.body) {
    const body = await response.json().catch(() => null);
    throw new Error(body?.error ?? 'Couldn’t reach the assistant. Check your connection.');
  }

  // The reply arrives as server-sent events: "event: <type>\ndata: <json>\n\n".
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let finished = false;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const blocks = buffer.split('\n\n');
    buffer = blocks.pop() ?? '';
    for (const block of blocks) {
      const type = block.match(/^event: (.+)$/m)?.[1];
      const json = block.match(/^data: (.+)$/m)?.[1];
      if (!type || !json) continue;
      const event = { type, ...JSON.parse(json) } as ChatEvent;
      if (event.type === 'error') throw new Error(event.message);
      if (event.type === 'done') finished = true;
      opts.onEvent(event);
    }
  }
  if (!finished) throw new Error('The reply was cut off. Try again.');
}
