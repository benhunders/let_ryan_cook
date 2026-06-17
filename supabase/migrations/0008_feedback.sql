-- Feedback & suggestions. Users submit general feedback, optionally linked to
-- a specific menu or dish. Customers see their own submissions; admins (Ryan)
-- read everything.

create table if not exists public.feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  menu_id uuid references public.menus (id) on delete set null,
  dish_id uuid references public.dishes (id) on delete set null,
  category text not null default 'general'
    check (category in ('general', 'suggestion', 'compliment', 'problem')),
  body text not null,
  created_at timestamptz not null default now()
);

create index if not exists feedback_user_id_idx on public.feedback (user_id);
create index if not exists feedback_created_at_idx on public.feedback (created_at desc);

alter table public.feedback enable row level security;

-- Users may submit their own feedback.
drop policy if exists feedback_insert_own on public.feedback;
create policy feedback_insert_own on public.feedback
  for insert to authenticated with check (auth.uid() = user_id);

-- Users read their own; admins read all.
drop policy if exists feedback_select on public.feedback;
create policy feedback_select on public.feedback
  for select using (auth.uid() = user_id or public.is_admin());
