-- Let Him Cook — initial schema, RLS, auth trigger, and storage bucket.

-- ─────────────────────────────────────────────────────────────────────────
-- Tables
-- ─────────────────────────────────────────────────────────────────────────
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text,
  full_name text,
  avatar_url text,
  is_admin boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.menus (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  week_start date,
  published boolean not null default false,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.dishes (
  id uuid primary key default gen_random_uuid(),
  menu_id uuid not null references public.menus (id) on delete cascade,
  name text not null,
  description text,
  price numeric(10, 2),
  image_url text,
  position int not null default 0,
  available boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  menu_id uuid not null references public.menus (id) on delete cascade,
  notes text,
  status text not null default 'submitted',
  created_at timestamptz not null default now(),
  unique (user_id, menu_id)
);

create table if not exists public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  dish_id uuid not null references public.dishes (id) on delete cascade,
  quantity int not null default 1 check (quantity > 0),
  note text
);

create index if not exists dishes_menu_id_idx on public.dishes (menu_id);
create index if not exists orders_menu_id_idx on public.orders (menu_id);
create index if not exists order_items_order_id_idx on public.order_items (order_id);

-- ─────────────────────────────────────────────────────────────────────────
-- Helper: is the current user an admin? SECURITY DEFINER avoids recursive
-- RLS evaluation when policies reference profiles.
-- ─────────────────────────────────────────────────────────────────────────
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select is_admin from public.profiles where id = auth.uid()), false);
$$;

-- ─────────────────────────────────────────────────────────────────────────
-- Auth trigger: create a profile on signup; auto-grant admin to allowlist.
-- ─────────────────────────────────────────────────────────────────────────
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  -- TODO: add Ryan's Google email here to grant him admin automatically.
  admin_emails text[] := array['benjaminhunders@gmail.com'];
begin
  insert into public.profiles (id, email, full_name, avatar_url, is_admin)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name'),
    new.raw_user_meta_data ->> 'avatar_url',
    new.email = any (admin_emails)
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ─────────────────────────────────────────────────────────────────────────
-- Row Level Security
-- ─────────────────────────────────────────────────────────────────────────
alter table public.profiles enable row level security;
alter table public.menus enable row level security;
alter table public.dishes enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;

-- profiles: readable by any signed-in user; writes happen only via the
-- SECURITY DEFINER trigger (no update/delete policies = denied).
drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles
  for select to authenticated using (true);

-- menus: anyone may read published menus; admins do everything.
drop policy if exists menus_select on public.menus;
create policy menus_select on public.menus
  for select using (published or public.is_admin());

drop policy if exists menus_admin_write on public.menus;
create policy menus_admin_write on public.menus
  for all using (public.is_admin()) with check (public.is_admin());

-- dishes: readable when their menu is published (or by admins); admins write.
drop policy if exists dishes_select on public.dishes;
create policy dishes_select on public.dishes
  for select using (
    public.is_admin()
    or exists (
      select 1 from public.menus m
      where m.id = dishes.menu_id and m.published
    )
  );

drop policy if exists dishes_admin_write on public.dishes;
create policy dishes_admin_write on public.dishes
  for all using (public.is_admin()) with check (public.is_admin());

-- orders: a user manages their own; admins can read all.
drop policy if exists orders_select on public.orders;
create policy orders_select on public.orders
  for select using (auth.uid() = user_id or public.is_admin());

drop policy if exists orders_insert_own on public.orders;
create policy orders_insert_own on public.orders
  for insert with check (auth.uid() = user_id);

drop policy if exists orders_update_own on public.orders;
create policy orders_update_own on public.orders
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists orders_delete_own on public.orders;
create policy orders_delete_own on public.orders
  for delete using (auth.uid() = user_id);

-- order_items: visible to the owning user or admins; writable by the owner.
drop policy if exists order_items_select on public.order_items;
create policy order_items_select on public.order_items
  for select using (
    exists (
      select 1 from public.orders o
      where o.id = order_items.order_id
        and (o.user_id = auth.uid() or public.is_admin())
    )
  );

drop policy if exists order_items_modify_own on public.order_items;
create policy order_items_modify_own on public.order_items
  for all using (
    exists (
      select 1 from public.orders o
      where o.id = order_items.order_id and o.user_id = auth.uid()
    )
  ) with check (
    exists (
      select 1 from public.orders o
      where o.id = order_items.order_id and o.user_id = auth.uid()
    )
  );

-- ─────────────────────────────────────────────────────────────────────────
-- Storage: public-read bucket for dish images; only admins may write.
-- ─────────────────────────────────────────────────────────────────────────
insert into storage.buckets (id, name, public)
values ('dish-images', 'dish-images', true)
on conflict (id) do nothing;

drop policy if exists dish_images_public_read on storage.objects;
create policy dish_images_public_read on storage.objects
  for select using (bucket_id = 'dish-images');

drop policy if exists dish_images_admin_write on storage.objects;
create policy dish_images_admin_write on storage.objects
  for all
  using (bucket_id = 'dish-images' and public.is_admin())
  with check (bucket_id = 'dish-images' and public.is_admin());
