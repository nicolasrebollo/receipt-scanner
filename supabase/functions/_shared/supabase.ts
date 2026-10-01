// Helpers shared by the notification functions.

import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2';

// The web version of the app calls functions from the browser, which requires CORS headers.
export const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

export function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  });
}

// Newer projects expose API keys as a JSON map; older ones only have the legacy single keys.
function keyFromMap(envName: string): string | undefined {
  const keys = JSON.parse(Deno.env.get(envName) ?? '{}') as Record<string, string>;
  return keys.default ?? Object.values(keys)[0];
}

/** Acts as the person calling the function; row-level security applies. */
export function userClient(req: Request): SupabaseClient {
  const key = keyFromMap('SUPABASE_PUBLISHABLE_KEYS') ?? Deno.env.get('SUPABASE_ANON_KEY')!;
  return createClient(Deno.env.get('SUPABASE_URL')!, key, {
    global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } },
  });
}

/** Bypasses row-level security. Needed to look up other household members' devices. */
export function adminClient(): SupabaseClient {
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? keyFromMap('SUPABASE_SECRET_KEYS')!;
  return createClient(Deno.env.get('SUPABASE_URL')!, key, { auth: { persistSession: false } });
}

export function formatMoney(amount: number, currency: string): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(amount);
}

/** "groceries" -> "Groceries" (category ids are lowercase labels). */
export function categoryLabel(id: string): string {
  return id.charAt(0).toUpperCase() + id.slice(1);
}
