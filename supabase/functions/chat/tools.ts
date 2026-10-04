// The tools the chat assistant uses to read the household's receipts and manage its memory.
// Every query runs as the signed-in person, so row-level security decides what can be seen.

import { betaZodTool } from 'npm:@anthropic-ai/sdk@0.129.0/helpers/beta/zod';
import type { SupabaseClient } from 'npm:@supabase/supabase-js@2';
import { z } from 'npm:zod@4';

// Keep in sync with src/lib/categories.ts and the receipts.category check constraint.
export const CATEGORIES = [
  'groceries',
  'dining',
  'transport',
  'shopping',
  'household',
  'health',
  'entertainment',
  'utilities',
  'travel',
  'other',
] as const;

export type ToolContext = {
  db: SupabaseClient;
  householdId: string;
  userId: string;
  members: { user_id: string; display_name: string }[];
  /** Called as each tool starts, so the app can show what the assistant is doing. */
  onToolUse: (label: string) => void;
};

type ReceiptRow = {
  id: string;
  merchant: string;
  total: number;
  purchased_on: string;
  category: string;
  notes: string | null;
  items: { name: string; price: number }[];
  created_by: string | null;
};

type Filters = {
  start_date?: string;
  end_date?: string;
  category?: string;
  merchant?: string;
  added_by?: string;
};

const MAX_ROWS = 10_000;
const MAX_MEMORIES = 50;

const dateField = (what: string) =>
  z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .describe(`${what}, as YYYY-MM-DD (inclusive)`);

const filterFields = {
  category: z.enum(CATEGORIES).optional().describe('Only this budget category'),
  merchant: z.string().optional().describe('Only merchants whose name contains this text (case-insensitive)'),
  added_by: z
    .string()
    .optional()
    .describe('Only receipts added by this household member (their name, or "me" for the person chatting)'),
};

const round = (n: number) => Math.round(n * 100) / 100;

function memberName(ctx: ToolContext, userId: string | null): string {
  return ctx.members.find((m) => m.user_id === userId)?.display_name ?? 'Former member';
}

/** Turns a name (or "me") into a user id; undefined when nobody matches. */
function resolveMember(ctx: ToolContext, name: string): string | undefined {
  const wanted = name.trim().toLowerCase();
  if (['me', 'i', 'myself', 'you'].includes(wanted)) return ctx.userId;
  return ctx.members.find((m) => m.display_name.toLowerCase() === wanted)?.user_id;
}

async function fetchReceipts(ctx: ToolContext, filters: Filters): Promise<ReceiptRow[]> {
  let memberId: string | undefined;
  if (filters.added_by) {
    memberId = resolveMember(ctx, filters.added_by);
    if (!memberId) {
      const names = ctx.members.map((m) => m.display_name).join(', ');
      throw new Error(`No household member is called "${filters.added_by}". Members: ${names}.`);
    }
  }

  const rows: ReceiptRow[] = [];
  // The API returns at most 1,000 rows per request, so page through.
  for (let from = 0; from < MAX_ROWS; from += 1000) {
    let query = ctx.db
      .from('receipts')
      .select('id, merchant, total, purchased_on, category, notes, items, created_by')
      .eq('household_id', ctx.householdId)
      .order('purchased_on', { ascending: false })
      .order('created_at', { ascending: false })
      .range(from, from + 999);
    if (filters.start_date) query = query.gte('purchased_on', filters.start_date);
    if (filters.end_date) query = query.lte('purchased_on', filters.end_date);
    if (filters.category) query = query.eq('category', filters.category);
    if (filters.merchant)
      query = query.ilike('merchant', `%${filters.merchant.replace(/[%_\\]/g, ' ').trim()}%`);
    if (memberId) query = query.eq('created_by', memberId);

    const { data, error } = await query;
    if (error) throw new Error(`Database error: ${error.message}`);
    for (const row of data as ReceiptRow[]) {
      rows.push({ ...row, total: Number(row.total), items: Array.isArray(row.items) ? row.items : [] });
    }
    if (data.length < 1000) break;
  }
  return rows;
}

/** The Sunday that starts the week containing `iso`. */
function weekStart(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  date.setUTCDate(date.getUTCDate() - date.getUTCDay());
  return date.toISOString().slice(0, 10);
}

/** Runs a tool body, reporting failures to the model as text so it can correct itself or explain. */
async function attempt(run: () => Promise<unknown>): Promise<string> {
  try {
    return JSON.stringify(await run());
  } catch (e) {
    return `Error: ${e instanceof Error ? e.message : 'the lookup failed'}`;
  }
}

export function buildTools(ctx: ToolContext) {
  const searchReceipts = betaZodTool({
    name: 'search_receipts',
    description:
      'Find and list individual receipts. Returns how many receipts match and their combined total, plus the receipts themselves (up to `limit`). Use it to look up specific purchases, the latest or largest receipts, or what a receipt contained.',
    inputSchema: z.object({
      start_date: dateField('Earliest purchase date').optional(),
      end_date: dateField('Latest purchase date').optional(),
      ...filterFields,
      text: z
        .string()
        .optional()
        .describe('Only receipts whose merchant, summary or item names contain this text'),
      min_total: z.number().optional().describe('Only receipts of at least this amount'),
      max_total: z.number().optional().describe('Only receipts of at most this amount'),
      sort: z.enum(['newest', 'oldest', 'largest', 'smallest']).optional().describe('Default: newest'),
      limit: z.number().int().min(1).max(50).optional().describe('How many receipts to return. Default 20'),
      include_items: z.boolean().optional().describe('Include each receipt’s itemized list. Default false'),
    }),
    run: (input) =>
      attempt(async () => {
        ctx.onToolUse('Looking through receipts');
        let rows = await fetchReceipts(ctx, input);
        if (input.text) {
          const needle = input.text.toLowerCase();
          rows = rows.filter((r) =>
            [r.merchant, r.notes ?? '', ...r.items.map((i) => i.name)].some((s) =>
              s.toLowerCase().includes(needle),
            ),
          );
        }
        if (input.min_total !== undefined) rows = rows.filter((r) => r.total >= input.min_total!);
        if (input.max_total !== undefined) rows = rows.filter((r) => r.total <= input.max_total!);

        const sort = input.sort ?? 'newest';
        if (sort === 'oldest') rows.reverse();
        if (sort === 'largest') rows.sort((a, b) => b.total - a.total);
        if (sort === 'smallest') rows.sort((a, b) => a.total - b.total);

        const shown = rows.slice(0, input.limit ?? 20);
        return {
          matching_count: rows.length,
          matching_total: round(rows.reduce((sum, r) => sum + r.total, 0)),
          shown: shown.length,
          receipts: shown.map((r) => ({
            id: r.id,
            date: r.purchased_on,
            merchant: r.merchant,
            total: r.total,
            category: r.category,
            added_by: memberName(ctx, r.created_by),
            ...(r.notes ? { summary: r.notes } : {}),
            ...(input.include_items ? { items: r.items } : { item_count: r.items.length }),
          })),
        };
      }),
  });

  const spendingSummary = betaZodTool({
    name: 'spending_summary',
    description:
      'Exact totals for a date range, optionally broken down by category, month, week, day, merchant or person. Use it for any "how much", comparison, trend, average or breakdown question; it adds the numbers up precisely. Call it once per period when comparing periods.',
    inputSchema: z.object({
      start_date: dateField('First day of the period'),
      end_date: dateField('Last day of the period'),
      group_by: z
        .enum(['none', 'category', 'month', 'week', 'day', 'merchant', 'person'])
        .describe('How to break the total down. Weeks start on Sunday.'),
      ...filterFields,
    }),
    run: (input) =>
      attempt(async () => {
        ctx.onToolUse('Adding up spending');
        const rows = await fetchReceipts(ctx, input);
        const total = rows.reduce((sum, r) => sum + r.total, 0);

        const keyOf: Record<typeof input.group_by, (r: ReceiptRow) => string> = {
          none: () => 'all',
          category: (r) => r.category,
          month: (r) => r.purchased_on.slice(0, 7),
          week: (r) => `week of ${weekStart(r.purchased_on)}`,
          day: (r) => r.purchased_on,
          merchant: (r) => r.merchant,
          person: (r) => memberName(ctx, r.created_by),
        };
        const groups = new Map<string, { total: number; receipt_count: number }>();
        for (const r of rows) {
          const key = keyOf[input.group_by](r);
          const g = groups.get(key) ?? { total: 0, receipt_count: 0 };
          g.total += r.total;
          g.receipt_count++;
          groups.set(key, g);
        }
        const byTime = ['month', 'week', 'day'].includes(input.group_by);
        const list = [...groups.entries()]
          .map(([group, g]) => ({ group, total: round(g.total), receipt_count: g.receipt_count }))
          .sort((a, b) => (byTime ? a.group.localeCompare(b.group) : b.total - a.total));

        return {
          period: `${input.start_date} to ${input.end_date}`,
          total: round(total),
          receipt_count: rows.length,
          average_per_receipt: rows.length ? round(total / rows.length) : 0,
          ...(input.group_by === 'none'
            ? {}
            : { groups: list.slice(0, 60), groups_omitted: Math.max(0, list.length - 60) }),
        };
      }),
  });

  const searchItems = betaZodTool({
    name: 'search_items',
    description:
      'Find individual line items across receipts by name, e.g. "oat milk" or "coffee", with what each cost and where it was bought. Only receipts that have an itemized list are covered (scanned receipts and ones where items were typed in), so tell the person the answer may be incomplete.',
    inputSchema: z.object({
      query: z.string().min(1).describe('Text the item name must contain (case-insensitive)'),
      start_date: dateField('Earliest purchase date').optional(),
      end_date: dateField('Latest purchase date').optional(),
    }),
    run: (input) =>
      attempt(async () => {
        ctx.onToolUse('Searching items');
        const rows = await fetchReceipts(ctx, input);
        const needle = input.query.toLowerCase();
        const matches = rows.flatMap((r) =>
          r.items
            .filter((item) => String(item.name).toLowerCase().includes(needle))
            .map((item) => ({
              date: r.purchased_on,
              merchant: r.merchant,
              item: item.name,
              price: Number(item.price) || 0,
            })),
        );
        return {
          match_count: matches.length,
          total_spent: round(matches.reduce((sum, m) => sum + m.price, 0)),
          receipts_with_item_lists: rows.filter((r) => r.items.length > 0).length,
          receipts_searched: rows.length,
          shown: Math.min(matches.length, 60),
          items: matches.slice(0, 60),
        };
      }),
  });

  const remember = betaZodTool({
    name: 'remember',
    description:
      'Save a lasting fact or preference so it is available in every future chat: a budget target, how the person wants something categorized or reported, who someone is. One short sentence. Not for one-off questions.',
    inputSchema: z.object({ fact: z.string().min(1).max(300) }),
    run: (input) =>
      attempt(async () => {
        ctx.onToolUse('Saving to memory');
        const { count } = await ctx.db.from('chat_memories').select('id', { count: 'exact', head: true });
        if ((count ?? 0) >= MAX_MEMORIES) {
          throw new Error(
            `Memory is full (${MAX_MEMORIES} items). Ask the person to remove some in the Memory list first.`,
          );
        }
        const { error } = await ctx.db
          .from('chat_memories')
          .insert({ household_id: ctx.householdId, content: input.fact.trim() });
        if (error) throw new Error(error.message);
        return { saved: true };
      }),
  });

  const forget = betaZodTool({
    name: 'forget',
    description: 'Remove a saved memory, using its id from the list of remembered things.',
    inputSchema: z.object({ memory_id: z.string() }),
    run: (input) =>
      attempt(async () => {
        ctx.onToolUse('Updating memory');
        const { data, error } = await ctx.db
          .from('chat_memories')
          .delete()
          .eq('id', input.memory_id)
          .select('id');
        if (error) throw new Error(error.message);
        if (!data?.length) throw new Error('No memory has that id.');
        return { removed: true };
      }),
  });

  return [searchReceipts, spendingSummary, searchItems, remember, forget];
}
