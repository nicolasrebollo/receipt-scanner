// The chat assistant. Takes one message from the app, lets Claude look things up in the
// household's receipts with tools, and streams the reply back as server-sent events:
//
//   event: conversation  { id, title }     (first; tells the app which conversation this is)
//   event: status        { label }         (what the assistant is doing, e.g. "Adding up spending")
//   event: delta         { text }          (a piece of the reply)
//   event: error         { message }
//   event: done          {}
//
// Conversations and messages are stored in the database; earlier turns are replayed as plain
// text on each request.

import Anthropic from 'npm:@anthropic-ai/sdk@0.129.0';

import { CORS_HEADERS, json, userClient } from '../_shared/supabase.ts';
import { buildTools, CATEGORIES } from './tools.ts';

const MODEL = 'claude-sonnet-5-5';
const MAX_MESSAGE_LENGTH = 4000;
/** How many earlier messages are replayed for context. */
const HISTORY_LIMIT = 40;

// Everything here is the same for every request, so it is cached between requests.
const INSTRUCTIONS = `You are the assistant inside Receipts, a household budgeting app. You answer questions about this household's spending using the receipts they have saved.

Looking things up
- The receipts are only available through your tools. Look them up before answering anything about spending, receipts, merchants, items or totals, even when an earlier answer in this chat seems to cover it: receipts are added and edited all the time. Never estimate an amount or recall one from earlier in the conversation.
- Use spending_summary for totals, comparisons, averages and breakdowns; it does the arithmetic exactly. Use search_receipts to find or list particular receipts. Use search_items for questions about individual products.
- Work out relative dates ("last month", "this week", "so far this year") from today's date, given below. Weeks start on Sunday. If a question gives no time frame, use the current month and say that you did.
- If a lookup returns nothing, say so plainly. Item-level answers only cover receipts that have an itemized list, so mention that they may be incomplete.
- You can also help with general budgeting questions. Be practical and brief.

Memory
- When the person tells you a lasting fact or preference that would help in future chats (a budget target, how they want something categorized or reported, who someone is), save it with the remember tool and mention in a few words that you've saved it. Don't save one-off questions, or anything already in the remembered list below.
- If they ask you to forget something, use the forget tool with that memory's id.

Style
- This is a chat on a phone. Lead with the answer and keep replies short: a sentence or two, plus a short list when there are several numbers.
- Write amounts as currency in the household's currency. Refer to people by name.
- The app displays only **bold**, *italics*, and simple lists that start with "-" or "1.". Don't use tables, headings, code blocks or links.
- Never show receipt ids or memory ids.`;

// Organization-level API keys must name a workspace; workspace-scoped keys don't need this.
const workspaceId = Deno.env.get('ANTHROPIC_WORKSPACE_ID');
const anthropic = new Anthropic(
  workspaceId ? { defaultHeaders: { 'anthropic-workspace-id': workspaceId } } : undefined,
);

function titleFrom(message: string): string {
  const text = message.replace(/\s+/g, ' ').trim();
  return text.length > 60 ? `${text.slice(0, 57).trimEnd()}…` : text;
}

function describeError(error: unknown): string {
  if (error instanceof Anthropic.RateLimitError)
    return 'Too many questions right now. Try again in a minute.';
  if (error instanceof Anthropic.AuthenticationError)
    return 'The server’s Anthropic API key is missing or invalid.';
  // Surface Claude's own explanation (e.g. "credit balance is too low") so setup problems are obvious.
  if (error instanceof Anthropic.APIError) return `Claude API error ${error.status ?? ''}: ${error.message}`;
  if (error instanceof Anthropic.AnthropicError) return `Claude setup error: ${error.message}`;
  return 'Something went wrong. Try again.';
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  const db = userClient(req);
  const { data: userData, error: authError } = await db.auth.getUser();
  if (authError || !userData.user) return json({ error: 'Not signed in' }, 401);
  const user = userData.user;

  const body = await req.json().catch(() => ({}));
  const message = typeof body.message === 'string' ? body.message.trim() : '';
  if (!message) return json({ error: 'Missing message' }, 400);
  if (message.length > MAX_MESSAGE_LENGTH) return json({ error: 'That message is too long.' }, 413);
  const today = /^\d{4}-\d{2}-\d{2}$/.test(body.today)
    ? (body.today as string)
    : new Date().toISOString().slice(0, 10);

  const { data: membership } = await db
    .from('household_members')
    .select('household_id')
    .eq('user_id', user.id)
    .maybeSingle();
  if (!membership) return json({ error: 'Join or create a household first.' }, 403);
  const householdId = membership.household_id as string;

  const [{ data: household }, { data: members }, { data: memories }] = await Promise.all([
    db.from('households').select('name, currency').eq('id', householdId).single(),
    db
      .from('household_members')
      .select('user_id, display_name')
      .eq('household_id', householdId)
      .order('joined_at'),
    db.from('chat_memories').select('id, content').eq('household_id', householdId).order('created_at'),
  ]);

  // Find the conversation, or start one.
  let conversation: { id: string; title: string };
  if (typeof body.conversation_id === 'string' && body.conversation_id) {
    const { data } = await db
      .from('chat_conversations')
      .select('id, title')
      .eq('id', body.conversation_id)
      .maybeSingle();
    if (!data) return json({ error: 'That conversation no longer exists.' }, 404);
    conversation = data;
  } else {
    const { data, error } = await db
      .from('chat_conversations')
      .insert({ household_id: householdId, title: titleFrom(message) })
      .select('id, title')
      .single();
    if (error) return json({ error: 'Could not start a conversation.' }, 500);
    conversation = data;
  }

  const { data: recent } = await db
    .from('chat_messages')
    .select('role, content')
    .eq('conversation_id', conversation.id)
    .order('created_at', { ascending: false })
    .limit(HISTORY_LIMIT);
  const history = (recent ?? []).reverse() as { role: 'user' | 'assistant'; content: string }[];
  while (history.length > 0 && history[0].role !== 'user') history.shift(); // the API needs a user turn first

  const { error: saveError } = await db
    .from('chat_messages')
    .insert({ conversation_id: conversation.id, role: 'user', content: message });
  if (saveError) return json({ error: 'Could not save your message.' }, 500);

  const weekday = new Date(`${today}T12:00:00Z`).toLocaleDateString('en-US', {
    weekday: 'long',
    timeZone: 'UTC',
  });
  const context = [
    `Today is ${weekday}, ${today}.`,
    `Household: "${household?.name ?? 'Household'}". Currency: ${household?.currency ?? 'USD'}.`,
    `Members: ${(members ?? []).map((m) => (m.user_id === user.id ? `${m.display_name} (the person you are talking to)` : m.display_name)).join(', ')}.`,
    `Budget categories: ${CATEGORIES.join(', ')}.`,
    'Remembered from earlier chats:',
    ...(memories?.length ? memories.map((m) => `- [id ${m.id}] ${m.content}`) : ['- (nothing yet)']),
  ].join('\n');

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let open = true;
      const send = (event: string, data: unknown) => {
        if (!open) return;
        try {
          controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
        } catch {
          open = false; // the app went away; keep going so the reply is still saved
        }
      };

      send('conversation', conversation);
      let reply = '';

      try {
        const tools = buildTools({
          db,
          householdId,
          userId: user.id,
          members: members ?? [],
          onToolUse: (label) => send('status', { label }),
        });

        const runner = anthropic.beta.messages.toolRunner({
          model: MODEL,
          max_tokens: 16000,
          // If Claude declines a request, retry it on the model Anthropic recommends instead of failing.
          betas: ['server-side-fallback-2026-07-01'],
          fallbacks: 'default',
          output_config: { effort: 'low' },
          // Cache the instructions and tools between requests, and the conversation between tool steps.
          cache_control: { type: 'ephemeral' },
          system: [
            { type: 'text', text: INSTRUCTIONS, cache_control: { type: 'ephemeral' } },
            { type: 'text', text: context },
          ],
          tools,
          messages: [...history, { role: 'user', content: message }],
          stream: true,
          max_iterations: 8,
        });

        // Tool inputs here are a few short fields, so they are left to the API's default
        // (buffered and validated) rather than streamed eagerly.
        for await (const messageStream of runner) {
          let startedText = false;
          for await (const event of messageStream) {
            if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
              // Separate text written before a tool call from the text that follows it.
              const text = !startedText && reply ? `\n\n${event.delta.text}` : event.delta.text;
              startedText = true;
              reply += text;
              send('delta', { text });
            }
          }
          const turn = await messageStream.finalMessage();
          console.log('usage', JSON.stringify(turn.usage));
          if (turn.stop_reason === 'refusal') {
            console.error('Refused', turn.stop_details);
            if (!reply) {
              reply = 'Sorry, I can’t help with that one.';
              send('delta', { text: reply });
            }
            break;
          }
          // A cut-off tool call can't be trusted; stop rather than run it.
          if (turn.stop_reason === 'max_tokens' && turn.content.some((b) => b.type === 'tool_use')) {
            throw new Error('Reply was cut off');
          }
        }

        if (reply) {
          await db
            .from('chat_messages')
            .insert({ conversation_id: conversation.id, role: 'assistant', content: reply });
          await db
            .from('chat_conversations')
            .update({ updated_at: new Date().toISOString() })
            .eq('id', conversation.id);
        }
        send('done', {});
      } catch (error) {
        console.error('Chat failed', error);
        // Keep whatever was already written so the conversation stays consistent on reload.
        if (reply) {
          await db
            .from('chat_messages')
            .insert({ conversation_id: conversation.id, role: 'assistant', content: reply });
        }
        send('error', { message: describeError(error) });
      } finally {
        if (open) controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: { ...CORS_HEADERS, 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache' },
  });
});
