-- Adds budget categories: rent, subscriptions, personal care, education, pets, gifts & donations, insurance.
-- Only the list of allowed values grows; existing receipts keep their categories and are not changed.
-- Safe to run twice.
--
-- Keep in sync with src/lib/categories.ts and supabase/functions/_shared/categories.ts.

alter table public.receipts drop constraint if exists receipts_category_check;

alter table public.receipts add constraint receipts_category_check check (category in (
  'groceries', 'dining', 'rent', 'utilities', 'subscriptions', 'transport', 'shopping',
  'household', 'health', 'personal_care', 'entertainment', 'travel', 'education', 'pets',
  'gifts', 'insurance', 'other'));
