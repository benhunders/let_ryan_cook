-- Data integrity + privacy hardening.
--
-- 1. Snapshot dish name/price onto order_items so editing or deleting a dish
--    never rewrites (or erases) a customer's order history.
-- 2. Add the business-rule constraints the schema was missing: status enum,
--    quantity bounds, non-negative prices, one line per dish per order.
-- 3. Lock the profiles table down to "own row or admin" (customers could
--    previously enumerate every user's name + email).
-- 4. Add menus.orders_locked so the chef can close ordering (cutoff).
-- 5. Enforce business rules in RLS itself: orders/items can only be written
--    against a published, unlocked menu, for available dishes on that menu.
-- 6. Add transactional RPCs (submit_order, save_menu) so multi-row writes
--    are atomic instead of a browser-driven sequence of requests.

-- ─────────────────────────────────────────────────────────────────────────
-- menus: ordering cutoff toggle
-- ─────────────────────────────────────────────────────────────────────────
alter table public.menus
  add column if not exists orders_locked boolean not null default false;

-- ─────────────────────────────────────────────────────────────────────────
-- dishes: prices can't be negative
-- ─────────────────────────────────────────────────────────────────────────
alter table public.dishes
  drop constraint if exists dishes_price_nonnegative;
alter table public.dishes
  add constraint dishes_price_nonnegative check (price is null or price >= 0);

-- ─────────────────────────────────────────────────────────────────────────
-- order_items: snapshots, dedupe, constraints
-- ─────────────────────────────────────────────────────────────────────────
alter table public.order_items
  add column if not exists dish_name text,
  add column if not exists dish_price numeric(10, 2);

update public.order_items oi
set dish_name = d.name, dish_price = d.price
from public.dishes d
where d.id = oi.dish_id and oi.dish_name is null;

-- Deleting a dish now preserves order history: the line keeps its snapshot
-- and dish_id nulls out (previously ON DELETE CASCADE erased the line).
alter table public.order_items alter column dish_id drop not null;
alter table public.order_items drop constraint if exists order_items_dish_id_fkey;
alter table public.order_items
  add constraint order_items_dish_id_fkey
  foreign key (dish_id) references public.dishes (id) on delete set null;

-- Merge any duplicate (order_id, dish_id) rows before enforcing uniqueness.
with dupes as (
  select order_id, dish_id,
         (array_agg(id order by id))[1] as keep_id,
         sum(quantity) as total
  from public.order_items
  where dish_id is not null
  group by order_id, dish_id
  having count(*) > 1
),
merged as (
  update public.order_items oi
  set quantity = least(d.total, 100)
  from dupes d
  where oi.id = d.keep_id
  returning oi.id
)
delete from public.order_items oi
using dupes d
where oi.order_id = d.order_id
  and oi.dish_id = d.dish_id
  and oi.id <> d.keep_id;

create unique index if not exists order_items_order_dish_uniq
  on public.order_items (order_id, dish_id);
create index if not exists order_items_dish_id_idx
  on public.order_items (dish_id);

-- Sane quantity bounds (was only "> 0").
update public.order_items set quantity = 100 where quantity > 100;
alter table public.order_items drop constraint if exists order_items_quantity_check;
alter table public.order_items
  add constraint order_items_quantity_check check (quantity between 1 and 100);

-- ─────────────────────────────────────────────────────────────────────────
-- orders: status becomes a real lifecycle instead of free text
-- ─────────────────────────────────────────────────────────────────────────
update public.orders
set status = 'submitted'
where status not in ('submitted', 'confirmed', 'completed', 'cancelled');
alter table public.orders drop constraint if exists orders_status_check;
alter table public.orders
  add constraint orders_status_check
  check (status in ('submitted', 'confirmed', 'completed', 'cancelled'));

-- ─────────────────────────────────────────────────────────────────────────
-- profiles: stop exposing the whole user base to every signed-in customer
-- ─────────────────────────────────────────────────────────────────────────
drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles
  for select to authenticated
  using (auth.uid() = id or public.is_admin());

-- ─────────────────────────────────────────────────────────────────────────
-- Snapshot trigger: covers every write path, including direct PostgREST.
-- ─────────────────────────────────────────────────────────────────────────
create or replace function public.order_items_snapshot()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.dish_id is not null then
    select d.name, d.price into new.dish_name, new.dish_price
    from public.dishes d
    where d.id = new.dish_id;
  end if;
  return new;
end;
$$;

revoke execute on function public.order_items_snapshot() from public, anon, authenticated;

drop trigger if exists order_items_snapshot_trg on public.order_items;
create trigger order_items_snapshot_trg
  before insert or update of dish_id on public.order_items
  for each row execute function public.order_items_snapshot();

-- ─────────────────────────────────────────────────────────────────────────
-- RLS helpers for the hardened write policies
-- ─────────────────────────────────────────────────────────────────────────
-- Is this order owned by the caller, still editable, and on an open menu?
create or replace function public.order_open_for(p_order_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.orders o
    join public.menus m on m.id = o.menu_id
    where o.id = p_order_id
      and o.user_id = auth.uid()
      and o.status = 'submitted'
      and m.published
      and not m.orders_locked
  );
$$;

-- Does this dish belong to the order's menu and is it available?
create or replace function public.dish_orderable(p_order_id uuid, p_dish_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.orders o
    join public.dishes d on d.menu_id = o.menu_id
    where o.id = p_order_id
      and d.id = p_dish_id
      and d.available
  );
$$;

revoke execute on function public.order_open_for(uuid) from public, anon;
revoke execute on function public.dish_orderable(uuid, uuid) from public, anon;
grant execute on function public.order_open_for(uuid) to authenticated;
grant execute on function public.dish_orderable(uuid, uuid) to authenticated;

-- ─────────────────────────────────────────────────────────────────────────
-- orders: writes only while the menu is published + unlocked and the order
-- is still 'submitted'. Users can never set any other status.
-- ─────────────────────────────────────────────────────────────────────────
drop policy if exists orders_insert_own on public.orders;
create policy orders_insert_own on public.orders
  for insert to authenticated
  with check (
    auth.uid() = user_id
    and status = 'submitted'
    and exists (
      select 1 from public.menus m
      where m.id = menu_id and m.published and not m.orders_locked
    )
  );

drop policy if exists orders_update_own on public.orders;
create policy orders_update_own on public.orders
  for update to authenticated
  using (
    auth.uid() = user_id
    and status = 'submitted'
    and exists (
      select 1 from public.menus m
      where m.id = orders.menu_id and m.published and not m.orders_locked
    )
  )
  with check (
    auth.uid() = user_id
    and status = 'submitted'
    and exists (
      select 1 from public.menus m
      where m.id = orders.menu_id and m.published and not m.orders_locked
    )
  );

drop policy if exists orders_delete_own on public.orders;
create policy orders_delete_own on public.orders
  for delete to authenticated
  using (
    auth.uid() = user_id
    and status = 'submitted'
    and exists (
      select 1 from public.menus m
      where m.id = orders.menu_id and m.published and not m.orders_locked
    )
  );

-- Admins may manage order status (confirm / complete / cancel).
drop policy if exists orders_admin_update on public.orders;
create policy orders_admin_update on public.orders
  for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- ─────────────────────────────────────────────────────────────────────────
-- order_items: replace the single broad policy with per-command policies
-- that enforce menu-open + dish-belongs-to-menu + availability.
-- ─────────────────────────────────────────────────────────────────────────
drop policy if exists order_items_modify_own on public.order_items;

drop policy if exists order_items_insert_own on public.order_items;
create policy order_items_insert_own on public.order_items
  for insert to authenticated
  with check (
    public.order_open_for(order_id)
    and public.dish_orderable(order_id, dish_id)
  );

drop policy if exists order_items_update_own on public.order_items;
create policy order_items_update_own on public.order_items
  for update to authenticated
  using (public.order_open_for(order_id))
  with check (
    public.order_open_for(order_id)
    and public.dish_orderable(order_id, dish_id)
  );

drop policy if exists order_items_delete_own on public.order_items;
create policy order_items_delete_own on public.order_items
  for delete to authenticated
  using (public.order_open_for(order_id));

-- ─────────────────────────────────────────────────────────────────────────
-- submit_order: the customer write path, as one atomic transaction.
-- Replaces the client's upsert → delete-all → insert sequence, which could
-- lose the whole order if a step failed mid-way.
-- p_items: [{ "dish_id": uuid, "quantity": int, "note": text | null }]
-- An empty p_items withdraws the order. Returns the order id (or null).
-- ─────────────────────────────────────────────────────────────────────────
create or replace function public.submit_order(
  p_menu_id uuid,
  p_notes text,
  p_items jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_order_id uuid;
  v_status text;
  v_count int;
begin
  if v_user is null then
    raise exception 'Not authenticated';
  end if;

  if not exists (
    select 1 from public.menus m
    where m.id = p_menu_id and m.published and not m.orders_locked
  ) then
    raise exception 'Ordering is closed for this menu';
  end if;

  if p_items is null or jsonb_typeof(p_items) <> 'array' then
    raise exception 'Invalid items payload';
  end if;

  select o.id, o.status into v_order_id, v_status
  from public.orders o
  where o.user_id = v_user and o.menu_id = p_menu_id;
  if v_order_id is not null and v_status <> 'submitted' then
    raise exception 'This order can no longer be changed';
  end if;

  select count(*) into v_count from jsonb_array_elements(p_items);
  if v_count > 200 then
    raise exception 'Too many items';
  end if;
  if v_count <> (
    select count(distinct it.dish_id)
    from jsonb_to_recordset(p_items) as it(dish_id uuid)
  ) then
    raise exception 'Duplicate dishes in order';
  end if;

  -- Every dish must be on this menu, available, with a sane quantity/note.
  if exists (
    select 1
    from jsonb_to_recordset(p_items)
           as it(dish_id uuid, quantity int, note text)
    left join public.dishes d
      on d.id = it.dish_id and d.menu_id = p_menu_id and d.available
    where d.id is null
       or it.quantity is null
       or it.quantity not between 1 and 100
       or length(coalesce(it.note, '')) > 500
  ) then
    raise exception 'Order contains an unavailable dish or an invalid quantity';
  end if;

  if length(coalesce(p_notes, '')) > 2000 then
    raise exception 'Order note is too long';
  end if;

  -- Empty selection = withdraw the order (cascades to its items).
  if v_count = 0 then
    delete from public.orders where user_id = v_user and menu_id = p_menu_id;
    return null;
  end if;

  insert into public.orders (user_id, menu_id, notes, status)
  values (v_user, p_menu_id, nullif(trim(p_notes), ''), 'submitted')
  on conflict (user_id, menu_id) do update
    set notes = excluded.notes
  returning id into v_order_id;

  delete from public.order_items oi
  where oi.order_id = v_order_id
    and (
      oi.dish_id is null
      or oi.dish_id not in (
        select it.dish_id
        from jsonb_to_recordset(p_items) as it(dish_id uuid)
      )
    );

  -- The BEFORE INSERT trigger fills the snapshots; EXCLUDED carries them
  -- through on the update path so a re-submit re-snapshots current prices.
  insert into public.order_items (order_id, dish_id, quantity, note)
  select v_order_id, it.dish_id, it.quantity, nullif(trim(it.note), '')
  from jsonb_to_recordset(p_items)
         as it(dish_id uuid, quantity int, note text)
  on conflict (order_id, dish_id) do update
    set quantity = excluded.quantity,
        note = excluded.note,
        dish_name = excluded.dish_name,
        dish_price = excluded.dish_price;

  return v_order_id;
end;
$$;

revoke execute on function public.submit_order(uuid, text, jsonb) from public, anon;
grant execute on function public.submit_order(uuid, text, jsonb) to authenticated;

-- ─────────────────────────────────────────────────────────────────────────
-- save_menu: the chef write path, as one atomic transaction.
-- Replaces the client's per-dish request loop that could half-save a menu.
-- p_dishes: ordered array of
--   { "id": uuid | null, "name": text, "description": text | null,
--     "price": number | null, "image_url": text | null, "available": bool }
-- Dishes missing from the payload are deleted (order history keeps its
-- snapshots). Returns the menu id.
-- ─────────────────────────────────────────────────────────────────────────
create or replace function public.save_menu(
  p_menu_id uuid,
  p_title text,
  p_week_start date,
  p_published boolean,
  p_orders_locked boolean,
  p_dishes jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_menu_id uuid := p_menu_id;
  r record;
begin
  if not public.is_admin() then
    raise exception 'Only admins can manage menus';
  end if;
  if coalesce(trim(p_title), '') = '' then
    raise exception 'Menu title is required';
  end if;
  if p_dishes is null or jsonb_typeof(p_dishes) <> 'array'
     or jsonb_array_length(p_dishes) = 0 then
    raise exception 'Add at least one dish';
  end if;
  if jsonb_array_length(p_dishes) > 100 then
    raise exception 'Too many dishes';
  end if;

  if v_menu_id is null then
    insert into public.menus (title, week_start, published, orders_locked, created_by)
    values (
      trim(p_title),
      p_week_start,
      coalesce(p_published, false),
      coalesce(p_orders_locked, false),
      auth.uid()
    )
    returning id into v_menu_id;
  else
    update public.menus
    set title = trim(p_title),
        week_start = p_week_start,
        published = coalesce(p_published, false),
        orders_locked = coalesce(p_orders_locked, false)
    where id = v_menu_id;
    if not found then
      raise exception 'Menu not found';
    end if;
  end if;

  delete from public.dishes d
  where d.menu_id = v_menu_id
    and d.id not in (
      select (e ->> 'id')::uuid
      from jsonb_array_elements(p_dishes) e
      where e ->> 'id' is not null
    );

  for r in
    select
      nullif(e.value ->> 'id', '')::uuid as id,
      trim(coalesce(e.value ->> 'name', '')) as name,
      nullif(trim(coalesce(e.value ->> 'description', '')), '') as description,
      nullif(trim(coalesce(e.value ->> 'price', '')), '')::numeric(10, 2) as price,
      nullif(trim(coalesce(e.value ->> 'image_url', '')), '') as image_url,
      coalesce((e.value ->> 'available')::boolean, true) as available,
      (e.ordinality - 1)::int as position
    from jsonb_array_elements(p_dishes) with ordinality as e(value, ordinality)
  loop
    if r.name = '' then
      raise exception 'Every dish needs a name';
    end if;
    if r.price is not null and r.price < 0 then
      raise exception 'Dish "%" has a negative price', r.name;
    end if;
    if r.id is null then
      insert into public.dishes
        (menu_id, name, description, price, image_url, position, available)
      values
        (v_menu_id, r.name, r.description, r.price, r.image_url, r.position, r.available);
    else
      update public.dishes
      set name = r.name,
          description = r.description,
          price = r.price,
          image_url = r.image_url,
          position = r.position,
          available = r.available
      where id = r.id and menu_id = v_menu_id;
      if not found then
        raise exception 'Dish "%" does not belong to this menu', r.name;
      end if;
    end if;
  end loop;

  return v_menu_id;
end;
$$;

revoke execute on function public.save_menu(uuid, text, date, boolean, boolean, jsonb) from public, anon;
grant execute on function public.save_menu(uuid, text, date, boolean, boolean, jsonb) to authenticated;
