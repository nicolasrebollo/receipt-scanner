// Reads a receipt photo with Claude and returns { merchant, total, purchased_on, category, summary, items }.
// The app shows the result on a review screen; nothing is saved here.

import Anthropic from 'npm:@anthropic-ai/sdk@0.129.0';
import { createClient } from 'npm:@supabase/supabase-js@2';

// Haiku is the cheapest model and reads receipts well enough; `claude-sonnet-5-5` or `claude-opus-5-5`
// are more accurate on long or crumpled receipts at 2x and 4x the price.
const MODEL = 'claude-haiku-4-5';

// Keep in sync with src/lib/categories.ts and the receipts.category check constraint.
const CATEGORIES = [
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
type Category = (typeof CATEGORIES)[number];

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const MAX_ITEMS = 40;

const SYSTEM_PROMPT = `You read photos of shopping receipts for a household budgeting app.

Extract:
- merchant: the store or business name as a person would say it ("Trader Joe's", not "TRADER JOE'S #552").
- total: the final amount paid, including tax and tip. Ignore subtotals, change due, and loyalty savings lines.
- purchased_on: the purchase date as YYYY-MM-DD, or an empty string if no date is visible. Receipts often print dates as MM/DD/YY; use today's date (given below) to pick the right century and to sanity-check the year.
- category: the single budget category that best fits the whole purchase:
  groceries (supermarkets, food to cook at home), dining (restaurants, cafes, bars, takeout, food delivery),
  transport (fuel, parking, rideshare, transit, car service), shopping (clothing, electronics, general retail),
  household (home goods, hardware, cleaning, furniture), health (pharmacy, medical, fitness),
  entertainment (movies, events, games, streaming, hobbies), utilities (phone, internet, power, water),
  travel (hotels, flights, rental cars), other (anything that fits none of these).
  For big-box stores, choose by what most of the items are.
- summary: one short plain sentence (under 100 characters) saying what was bought, the way you'd jot it in a budget: "Weekly groceries: produce, dairy and snacks" or "Dinner for two with drinks". No merchant name, no amounts.
- items: every purchased line item, in receipt order, each with:
  - name: a readable name. Expand obvious abbreviations ("ORG BNNA" -> "Organic bananas"). If a quantity above 1 is printed, lead with it ("2 x Oat milk").
  - price: the amount charged for that line (quantity already applied), as printed.
  Leave out tax, tip, subtotal, total, payment, change and discount lines. If an item's price can't be read, use 0.
  If there are more than ${MAX_ITEMS} items, list the ${MAX_ITEMS} most expensive. If the receipt has no itemized lines (a card slip, say), return an empty list.
- is_receipt: false if the image is not a receipt or is too blurry to read a total. Then use merchant "", total 0, summary "", items [].`;

const OUTPUT_SCHEMA = {
  type: 'object',
  properties: {
    is_receipt: { type: 'boolean' },
    merchant: { type: 'string' },
    total: { type: 'number' },
    purchased_on: { type: 'string' },
    category: { type: 'string', enum: [...CATEGORIES] },
    summary: { type: 'string' },
    items: {
      type: 'array',
      items: {
        type: 'object',
        properties: { name: { type: 'string' }, price: { type: 'number' } },
        required: ['name', 'price'],
        additionalProperties: false,
      },
    },
  },
  required: ['is_receipt', 'merchant', 'total', 'purchased_on', 'category', 'summary', 'items'],
  additionalProperties: false,
};

type ScanOutput = {
  is_receipt: boolean;
  merchant: string;
  total: number;
  purchased_on: string;
  category: Category;
  summary: string;
  items: { name: string; price: number }[];
};

const roundMoney = (n: number) => (Number.isFinite(n) ? Math.max(0, Math.round(n * 100) / 100) : 0);

// Organization-level API keys must name a workspace; workspace-scoped keys don't need this.
const workspaceId = Deno.env.get('ANTHROPIC_WORKSPACE_ID');
const anthropic = new Anthropic(
  workspaceId ? { defaultHeaders: { 'anthropic-workspace-id': workspaceId } } : undefined,
);

// Newer projects expose publishable keys as a JSON map; older ones only have the legacy anon key.
function publicKey(): string {
  const keys = JSON.parse(Deno.env.get('SUPABASE_PUBLISHABLE_KEYS') ?? '{}') as Record<string, string>;
  return keys.default ?? Object.values(keys)[0] ?? Deno.env.get('SUPABASE_ANON_KEY')!;
}

// The web version of the app calls this from the browser, which requires CORS headers.
const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  // Only signed-in app users may spend API credits.
  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, publicKey(), {
    global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } },
  });
  const { data: userData, error: authError } = await supabase.auth.getUser();
  if (authError || !userData.user) return json({ error: 'Not signed in' }, 401);

  let imageBase64: string;
  let today: string;
  try {
    const body = await req.json();
    imageBase64 = String(body.image_base64 ?? '');
    today = /^\d{4}-\d{2}-\d{2}$/.test(body.today) ? body.today : new Date().toISOString().slice(0, 10);
  } catch {
    return json({ error: 'Invalid request body' }, 400);
  }
  if (!imageBase64) return json({ error: 'Missing image' }, 400);
  if (imageBase64.length * 0.75 > MAX_IMAGE_BYTES) return json({ error: 'Image too large' }, 413);

  let response: Anthropic.Message;
  try {
    response = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 8000,
      output_config: { format: { type: 'json_schema', schema: OUTPUT_SCHEMA } },
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: { type: 'base64', media_type: 'image/jpeg', data: imageBase64 },
            },
            { type: 'text', text: `Today is ${today}. Read this receipt.` },
          ],
        },
      ],
    });
  } catch (error) {
    console.error('Claude request failed', error);
    if (error instanceof Anthropic.RateLimitError) {
      return json({ error: 'Too many scans right now. Try again in a minute.' }, 429);
    }
    if (error instanceof Anthropic.AuthenticationError) {
      return json({ error: 'The server’s Anthropic API key is missing or invalid.' }, 502);
    }
    if (error instanceof Anthropic.APIError) {
      // Surface Claude's own explanation (e.g. "credit balance is too low") so setup problems are obvious.
      return json({ error: `Claude API error ${error.status ?? ''}: ${error.message}` }, 502);
    }
    if (error instanceof Anthropic.AnthropicError) {
      return json({ error: `Claude setup error: ${error.message}` }, 502);
    }
    return json({ error: "Couldn't read the receipt. Try again or enter it manually." }, 502);
  }

  if (response.stop_reason === 'refusal' || response.stop_reason === 'max_tokens') {
    console.error('Unusable response', response.stop_reason, response.stop_details);
    return json({ error: "Couldn't read the receipt. Try again or enter it manually." }, 502);
  }

  const text = response.content.find((block) => block.type === 'text');
  let parsed: ScanOutput;
  try {
    parsed = JSON.parse(text?.type === 'text' ? text.text : '');
  } catch {
    console.error('Unparseable output', text);
    return json({ error: "Couldn't read the receipt. Try again or enter it manually." }, 502);
  }

  if (!parsed.is_receipt) {
    return json({ error: "That doesn't look like a readable receipt. Try a closer, flatter photo." }, 422);
  }

  // Structured output doesn't guarantee the capitalization of enum values.
  const category = String(parsed.category).toLowerCase() as Category;

  return json({
    merchant: parsed.merchant.trim().slice(0, 120),
    total: roundMoney(parsed.total),
    purchased_on: /^\d{4}-\d{2}-\d{2}$/.test(parsed.purchased_on) ? parsed.purchased_on : today,
    category: CATEGORIES.includes(category) ? category : 'other',
    summary: (parsed.summary ?? '').trim().slice(0, 200),
    items: (parsed.items ?? [])
      .map((item) => ({
        name: String(item.name ?? '')
          .trim()
          .slice(0, 80),
        price: roundMoney(item.price),
      }))
      .filter((item) => item.name)
      .slice(0, MAX_ITEMS),
  });
});
