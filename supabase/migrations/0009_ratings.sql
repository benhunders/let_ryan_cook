-- Dish ratings & reviews. Customers rate dishes (1–5) with an optional comment;
-- one rating per user per dish. Averages are public (like reviews); each user
-- manages only their own rating. The UI invites ratings on completed orders.

create table if not exists public.ratings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  dish_id uuid not null references public.dishes (id) on delete cascade,
  rating int not null check (rating between 1 and 5),
  comment text,
  created_at timestamptz not null default now(),
  unique (user_id, dish_id)
);

create index if not exists ratings_dish_id_idx on public.ratings (dish_id);

alter table public.ratings enable row level security;

-- Ratings are readable by everyone (powers public averages on the menu).
drop policy if exists ratings_select on public.ratings;
create policy ratings_select on public.ratings
  for select using (true);

-- Each user manages only their own rating.
drop policy if exists ratings_modify_own on public.ratings;
create policy ratings_modify_own on public.ratings
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
