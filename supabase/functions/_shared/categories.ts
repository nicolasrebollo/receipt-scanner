// Budget categories, shared by the server functions.
// Keep in sync with src/lib/categories.ts and the receipts_category_check constraint
// (supabase/migrations/20261102000000_more_categories.sql).

export const CATEGORY_INFO = [
  { id: 'groceries', label: 'Groceries', covers: 'supermarkets, food to cook at home' },
  { id: 'dining', label: 'Dining', covers: 'restaurants, cafes, bars, takeout, food delivery' },
  { id: 'rent', label: 'Rent', covers: 'rent or mortgage payments, property management, HOA fees' },
  { id: 'utilities', label: 'Utilities', covers: 'power, gas, water, trash, phone and internet bills' },
  {
    id: 'subscriptions',
    label: 'Subscriptions',
    covers: 'recurring memberships and services: streaming, apps, software, news, gym memberships',
  },
  {
    id: 'transport',
    label: 'Transport',
    covers: 'fuel, parking, tolls, rideshare, transit, car service and repairs',
  },
  { id: 'shopping', label: 'Shopping', covers: 'clothing, electronics, general retail' },
  { id: 'household', label: 'Household', covers: 'home goods, hardware, cleaning supplies, furniture' },
  { id: 'health', label: 'Health', covers: 'pharmacy, doctors, dentists, medical' },
  { id: 'personal_care', label: 'Personal care', covers: 'haircuts, salons, spas, toiletries, cosmetics' },
  { id: 'entertainment', label: 'Entertainment', covers: 'movies, concerts, events, games, hobbies' },
  { id: 'travel', label: 'Travel', covers: 'hotels, flights, rental cars, vacation costs' },
  { id: 'education', label: 'Education', covers: 'tuition, courses, books for study, school supplies' },
  { id: 'pets', label: 'Pets', covers: 'pet food, vet visits, grooming, pet supplies' },
  { id: 'gifts', label: 'Gifts & donations', covers: 'presents for others, charity donations' },
  { id: 'insurance', label: 'Insurance', covers: 'car, home, renters, health and life insurance premiums' },
  { id: 'other', label: 'Other', covers: 'anything that fits none of these' },
] as const;

export type Category = (typeof CATEGORY_INFO)[number]['id'];

export const CATEGORIES = CATEGORY_INFO.map((c) => c.id) as [Category, ...Category[]];

/** "personal_care" -> "Personal care". */
export function categoryLabel(id: string): string {
  return CATEGORY_INFO.find((c) => c.id === id)?.label ?? 'Other';
}

/** One line per category, for prompts: "groceries (supermarkets, food to cook at home)". */
export const CATEGORY_GUIDE = CATEGORY_INFO.map((c) => `- ${c.id}: ${c.covers}`).join('\n');
