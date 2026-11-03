import type { SFSymbol } from 'expo-symbols';

// Keep in sync with supabase/functions/_shared/categories.ts and the receipts_category_check
// constraint (supabase/migrations/20261102000000_more_categories.sql).
export const CATEGORIES = [
  { id: 'groceries', label: 'Groceries', icon: 'cart' },
  { id: 'dining', label: 'Dining', icon: 'fork.knife' },
  { id: 'rent', label: 'Rent', icon: 'key' },
  { id: 'utilities', label: 'Utilities', icon: 'bolt' },
  { id: 'subscriptions', label: 'Subscriptions', icon: 'arrow.triangle.2.circlepath' },
  { id: 'transport', label: 'Transport', icon: 'car' },
  { id: 'shopping', label: 'Shopping', icon: 'bag' },
  { id: 'household', label: 'Household', icon: 'house' },
  { id: 'health', label: 'Health', icon: 'heart' },
  { id: 'personal_care', label: 'Personal care', icon: 'scissors' },
  { id: 'entertainment', label: 'Entertainment', icon: 'ticket' },
  { id: 'travel', label: 'Travel', icon: 'airplane' },
  { id: 'education', label: 'Education', icon: 'book' },
  { id: 'pets', label: 'Pets', icon: 'pawprint' },
  { id: 'gifts', label: 'Gifts & donations', icon: 'gift' },
  { id: 'insurance', label: 'Insurance', icon: 'shield' },
  { id: 'other', label: 'Other', icon: 'square.grid.2x2' },
] as const satisfies readonly { id: string; label: string; icon: SFSymbol }[];

export type CategoryId = (typeof CATEGORIES)[number]['id'];

export function categoryById(id: string) {
  return CATEGORIES.find((c) => c.id === id) ?? CATEGORIES[CATEGORIES.length - 1];
}
