-- Payments, delivery day, and two more feedback categories.
--
-- 1. orders.payment_method — the customer says how they'll pay (cash or meal
--    ticket) when they order.
-- 2. orders.paid / paid_at — the chef marks an order paid on the fulfillment
--    view. Guarded by a trigger so customers can never flip their own "paid".
-- 3. menus.delivery_date — the day the chef delivers/hands out the food, shown
--    to customers (their preferred day still goes in the order note).
-- 4. feedback categories gain "requested_dish" and "dietary".
-- 5. submit_order + save_menu grow the matching parameters.

-- ─────────────────────────────────────────────────────────────────────────
-- Columns
-- ─────────────────────────────────────────────────────────────────────────
alter table public.orders
  add column if not exists payment_method text not null default 'cash',
  add column if not exists paid boolean not null default false,
  add column if not exists paid_at timestamptz;

alter table public.orders drop constraint if exists orders_payment_method_check;
alter table public.orders
  add constraint orders_payment_method_check
  check (payment_method in ('cash', 'ticket'));

alter table public.menus
  add column if not exists delivery_date date;

-- ─────────────────────────────────────────────────────────────────────────
-- Feedback: two more categories (kept in sync with lib/feedback.ts)
-- ─────────────────────────────────────────────────────────────────────────
alter table public.feedback drop constraint if exists feedback_category_check;
alter table public.feedback
  add constraint feedback_category_check
  check (category in (
    'general', 'suggestion', 'compliment', 'problem',
    'requested_dish', 'dietary'
  ));

-- ─────────────────────────────────────────────────────────────────────────
-- Guard: only admins may change paid / paid_at. RLS can't restrict columns,
-- so this trigger pins those fields for non-admins and auto-stamps paid_at.
-- ─────────────────────────────────────────────────────────────────────────
create or replace function public.orders_guard_paid()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    -- Customers can never set or clear payment status on their own order.
    new.paid := coalesce(old.paid, false);
    new.paid_at := case when tg_op = 'UPDATE' then old.paid_at else null end;
  else
    -- Admin flips paid → stamp (or clear) paid_at automatically.
    if tg_op = 'UPDATE' and new.paid is distinct from old.paid then
      new.paid_at := case when new.paid then now() else null end;
    elsif tg_op = 'INSERT' and new.paid then
      new.paid_at := now();
    end if;
  end if;
  return new;
end;
$$;

revoke execute on function public.orders_guard_paid() from public, anon, authenticated;

drop trigger if exists orders_guard_paid_trg on public.orders;
create trigger orders_guard_paid_trg
  before insert or update on public.orders
  for each row execute function public.orders_guard_paid();

-- ─────────────────────────────────────────────────────────────────────────
-- submit_order: now records the payment method too.
-- ─────────────────────────────────────────────────────────────────────────
drop function if exists public.submit_order(uuid, text, jsonb);

create or replace function public.submit_order(
  p_menu_id uuid,
  p_notes text,
  p_items jsonb,
  p_payment_method text default 'cash'
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_is_admin boolean := public.is_admin();
  v_order_id uuid;
  v_status text;
  v_count int;
  v_payment text := coalesce(p_payment_method, 'cash');
begin
  if v_user is null then
    raise exception 'Not authenticated';
  end if;

  if v_payment not in ('cash', 'ticket') then
    raise exception 'Invalid payment method';
  end if;

  if not exists (select 1 from public.menus m where m.id = p_menu_id) then
    raise exception 'Menu not found';
  end if;

  if not v_is_admin and not exists (
    select 1 from public.menus m
    where m.id = p_menu_id
      and m.published
      and not m.orders_locked
      and (m.order_deadline is null or now() < m.order_deadline)
  ) then
    raise exception 'Ordering is closed for this menu';
  end if;

  if p_items is null or jsonb_typeof(p_items) <> 'array' then
    raise exception 'Invalid items payload';
  end if;

  select o.id, o.status into v_order_id, v_status
  from public.orders o
  where o.user_id = v_user and o.menu_id = p_menu_id;
  if v_order_id is not null and v_status <> 'submitted' and not v_is_admin then
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

  insert into public.orders (user_id, menu_id, notes, status, payment_method)
  values (v_user, p_menu_id, nullif(trim(p_notes), ''), 'submitted', v_payment)
  on conflict (user_id, menu_id) do update
    set notes = excluded.notes,
        payment_method = excluded.payment_method
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

revoke execute on function public.submit_order(uuid, text, jsonb, text) from public, anon;
grant execute on function public.submit_order(uuid, text, jsonb, text) to authenticated;

-- ─────────────────────────────────────────────────────────────────────────
-- save_menu: now stores the delivery date.
-- ─────────────────────────────────────────────────────────────────────────
drop function if exists public.save_menu(uuid, text, date, timestamptz, boolean, boolean, jsonb);

create or replace function public.save_menu(
  p_menu_id uuid,
  p_title text,
  p_week_start date,
  p_order_deadline timestamptz,
  p_delivery_date date,
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
  if p_dishes is null or jsonb_typeof(p_dishes) <> 'array' then
    raise exception 'Invalid dishes payload';
  end if;
  if jsonb_array_length(p_dishes) > 100 then
    raise exception 'Too many dishes';
  end if;
  if coalesce(p_published, false) and jsonb_array_length(p_dishes) = 0 then
    raise exception 'Add at least one dish before publishing';
  end if;

  if v_menu_id is null then
    insert into public.menus
      (title, week_start, order_deadline, delivery_date, published, orders_locked, created_by)
    values (
      trim(p_title),
      p_week_start,
      p_order_deadline,
      p_delivery_date,
      coalesce(p_published, false),
      coalesce(p_orders_locked, false),
      auth.uid()
    )
    returning id into v_menu_id;
  else
    update public.menus
    set title = trim(p_title),
        week_start = p_week_start,
        order_deadline = p_order_deadline,
        delivery_date = p_delivery_date,
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
      array(
        select jsonb_array_elements_text(coalesce(e.value -> 'allergens', '[]'::jsonb))
      )::text[] as allergens,
      array(
        select jsonb_array_elements_text(coalesce(e.value -> 'dietary_tags', '[]'::jsonb))
      )::text[] as dietary_tags,
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
        (menu_id, name, description, price, image_url, position, available,
         allergens, dietary_tags)
      values
        (v_menu_id, r.name, r.description, r.price, r.image_url, r.position,
         r.available, r.allergens, r.dietary_tags);
    else
      update public.dishes
      set name = r.name,
          description = r.description,
          price = r.price,
          image_url = r.image_url,
          position = r.position,
          available = r.available,
          allergens = r.allergens,
          dietary_tags = r.dietary_tags
      where id = r.id and menu_id = v_menu_id;
      if not found then
        raise exception 'Dish "%" does not belong to this menu', r.name;
      end if;
    end if;
  end loop;

  return v_menu_id;
end;
$$;

revoke execute on function public.save_menu(uuid, text, date, timestamptz, date, boolean, boolean, jsonb) from public, anon;
grant execute on function public.save_menu(uuid, text, date, timestamptz, date, boolean, boolean, jsonb) to authenticated;
