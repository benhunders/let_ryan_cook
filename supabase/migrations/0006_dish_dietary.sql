-- Allergen + dietary labels on dishes.
-- Responsibility for allergy safety stays with the informed customer: Ryan
-- tags each dish, the labels render on the menu. We deliberately do NOT store
-- per-user allergy data (which would be GDPR special-category health data).
--
-- `allergens` holds values from the 14 EU-declared allergens; `dietary_tags`
-- holds positive descriptors (vegetarian, vegan, etc). See lib/dietary.ts.
-- Both default to empty arrays so existing rows and pre-migration reads are
-- safe. No RLS changes needed: these columns inherit the existing dishes
-- policies (admin write, published-read for customers).

alter table public.dishes
  add column if not exists allergens text[] not null default '{}',
  add column if not exists dietary_tags text[] not null default '{}';
