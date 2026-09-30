import type { SFSymbol } from 'expo-symbols';

// Keep in sync with supabase/functions/scan-receipt and the receipts.category check constraint.
export const CATEGORIES = [
  { id: 'groceries', label: 'Groceries', icon: 'cart' },
  { id: 'dining', label: 'Dining', icon: 'fork.knife' },
  { id: 'transport', label: 'Transport', icon: 'car' },
  { id: 'shopping', label: 'Shopping', icon: 'bag' },
  { id: 'household', label: 'Household', icon: 'house' },
  { id: 'health', label: 'Health', icon: 'heart' },
  { id: 'entertainment', label: 'Entertainment', icon: 'ticket' },
  { id: 'utilities', label: 'Utilities', icon: 'bolt' },
  { id: 'travel', label: 'Travel', icon: 'airplane' },
  { id: 'other', label: 'Other', icon: 'square.grid.2x2' },
] as const satisfies readonly { id: string; label: string; icon: SFSymbol }[];

export type CategoryId = (typeof CATEGORIES)[number]['id'];

export function categoryById(id: string) {
  return CATEGORIES.find((c) => c.id === id) ?? CATEGORIES[CATEGORIES.length - 1];
}
