import type { CategoryId } from '@/lib/categories';

export type Household = {
  id: string;
  name: string;
  currency: string;
  invite_code: string;
};

export type Member = {
  user_id: string;
  display_name: string;
};

export type Receipt = {
  id: string;
  household_id: string;
  created_by: string | null;
  merchant: string;
  total: number;
  purchased_on: string; // YYYY-MM-DD
  category: CategoryId;
  notes: string | null;
  image_path: string | null;
  created_at: string;
};

export type ReceiptDraft = {
  merchant: string;
  total: string; // as typed, e.g. "12.50"
  purchased_on: string;
  category: CategoryId;
  notes: string;
};
