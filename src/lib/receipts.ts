import type { CategoryId } from '@/lib/categories';
import type { DateRange } from '@/lib/dates';
import { supabase } from '@/lib/supabase';
import type { Receipt } from '@/lib/types';

export type ReceiptQuery = {
  householdId: string;
  range?: DateRange;
  search?: string;
  category?: CategoryId;
};

export type ReceiptInput = {
  merchant: string;
  total: number;
  purchased_on: string;
  category: CategoryId;
  notes: string | null;
};

const COLUMNS =
  'id, household_id, created_by, merchant, total, purchased_on, category, notes, image_path, created_at';

function normalize(row: Receipt): Receipt {
  return { ...row, total: Number(row.total) };
}

export async function listReceipts(q: ReceiptQuery): Promise<Receipt[]> {
  let query = supabase
    .from('receipts')
    .select(COLUMNS)
    .eq('household_id', q.householdId)
    .order('purchased_on', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(2000);
  if (q.range) query = query.gte('purchased_on', q.range.start).lte('purchased_on', q.range.end);
  if (q.category) query = query.eq('category', q.category);
  // Strip characters that have meaning in PostgREST filter syntax.
  const search = q.search?.replace(/[%,()*\\]/g, ' ').trim();
  if (search) query = query.or(`merchant.ilike.%${search}%,notes.ilike.%${search}%`);

  const { data, error } = await query;
  if (error) throw error;
  return (data as Receipt[]).map(normalize);
}

export async function getReceipt(id: string): Promise<Receipt> {
  const { data, error } = await supabase.from('receipts').select(COLUMNS).eq('id', id).single();
  if (error) throw error;
  return normalize(data as Receipt);
}

function base64ToBytes(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

export async function createReceipt(
  householdId: string,
  input: ReceiptInput,
  imageBase64?: string,
): Promise<void> {
  let imagePath: string | null = null;
  if (imageBase64) {
    imagePath = `${householdId}/${Date.now()}-${Math.random().toString(36).slice(2, 10)}.jpg`;
    const { error } = await supabase.storage
      .from('receipts')
      .upload(imagePath, base64ToBytes(imageBase64), { contentType: 'image/jpeg' });
    // The receipt matters more than its photo; save it even if the upload fails.
    if (error) {
      console.warn('Receipt photo upload failed', error);
      imagePath = null;
    }
  }

  const { error } = await supabase
    .from('receipts')
    .insert({ ...input, household_id: householdId, image_path: imagePath });
  if (error) throw error;
}

export async function updateReceipt(id: string, input: ReceiptInput): Promise<void> {
  const { error } = await supabase.from('receipts').update(input).eq('id', id);
  if (error) throw error;
}

export async function deleteReceipt(receipt: Receipt): Promise<void> {
  const { error } = await supabase.from('receipts').delete().eq('id', receipt.id);
  if (error) throw error;
  if (receipt.image_path) {
    await supabase.storage.from('receipts').remove([receipt.image_path]);
  }
}

export async function receiptImageUrl(path: string): Promise<string | null> {
  const { data } = await supabase.storage.from('receipts').createSignedUrl(path, 60 * 60);
  return data?.signedUrl ?? null;
}
