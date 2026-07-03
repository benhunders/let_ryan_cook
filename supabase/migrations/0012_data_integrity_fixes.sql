-- Reconcile 0011 with the order-status workflow (0007) and order deadline
-- (0010): 0011 was authored against an older schema and overwrote their
-- policies and status constraint.
--
-- • Restore the full status state machine (preparing/ready; drop 'confirmed').
-- • Fold the order deadline and the admin bypass (needed by the menu preview,
--   where admins test-order on drafts) back into the customer write policies,
--   order_open_for(), and submit_order(); respect orders_locked everywhere.
-- • Drop the duplicate admin update policy added by 0011 (0007's
--   orders_update_admin already covers it).
-- • Extend save_menu() with the order deadline + allergen/dietary fields.
-- • Add admin_emails() so the order-notification route still works now that
--   profiles are no longer readable by every signed-in user.

alter table public.orders drop constraint if exists orders_status_check;
alter table public.orders add constraint orders_status_check
  check (status in ('submitted', 'preparing', 'ready', 'completed', 'cancelled'));

drop policy if exists orders_admin_update on public.orders;

-- ─────────────────────────────────────────────────────────────────────────
-- Customer order policies: a menu is "open" when it is published, not
-- locked by the chef, and before its deadline. Admins bypass so they can
-- test-order on drafts via the preview page.
-- ─────────────────────────────────────────────────────────────────────────
drop policy if exists orders_insert_own on public.orders;
create policy orders_insert_own on public.orders
  for insert to authenticated
  with check (
    auth.uid() = user_id
    and (
      public.is_admin()
      or (
        status = 'submitted'
        and exists (
          select 1 from public.menus m
          where m.id = menu_id
            and m.published
            and not m.orders_locked
            and (m.order_deadline is null or now() < m.order_deadline)
        )
      )
    )
  );

drop policy if exists orders_update_own on public.orders;
create policy orders_update_own on public.orders
  for update to authenticated
  using (
    auth.uid() = user_id
    and (
      public.is_admin()
      or (
        status = 'submitted'
        and exists (
          select 1 from public.menus m
          where m.id = orders.menu_id
            and m.published
            and not m.orders_locked
            and (m.order_deadline is null or now() < m.order_deadline)
        )
      )
    )
  )
  with check (
    auth.uid() = user_id
    and (
      public.is_admin()
      or (
        status = 'submitted'
        and exists (
          select 1 from public.menus m
          where m.id = orders.menu_id
            and m.published
            and not m.orders_locked
            and (m.order_deadline is null or now() < m.order_deadline)
        )
      )
    )
  );

drop policy if exists orders_delete_own on public.orders;
create policy orders_delete_own on public.orders
  for delete to authenticated
  using (
    auth.uid() = user_id
    and (
      public.is_admin()
      or (
        status = 'submitted'
        and exists (
          select 1 from public.menus m
          where m.id = orders.menu_id
            and m.published
            and not m.orders_locked
            and (m.order_deadline is null or now() < m.order_deadline)
        )
      )
    )
  );

-- ─────────────────────────────────────────────────────────────────────────
-- order_open_for: same "open" definition for the order_items policies.
-- ─────────────────────────────────────────────────────────────────────────
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
      and (
        public.is_admin()
        or (
          o.status = 'submitted'
          and m.published
          and not m.orders_locked
          and (m.order_deadline is null or now() < m.order_deadline)
        )
      )
  );
$$;

-- ─────────────────────────────────────────────────────────────────────────
-- submit_order: menu-open check now includes the deadline, with the same
-- admin bypass for preview test-orders.
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
  v_is_admin boolean := public.is_admin();
  v_order_id uuid;
  v_status text;
  v_count int;
begin
  if v_user is null then
    raise exception 'Not authenticated';
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
-- save_menu: new signature adds the order deadline and per-dish
-- allergens/dietary_tags. The old 6-arg version is dropped.
-- p_dishes: ordered array of
--   { "id": uuid | null, "name": text, "description": text | null,
--     "price": number | null, "image_url": text | null, "available": bool,
--     "allergens": text[], "dietary_tags": text[] }
-- ─────────────────────────────────────────────────────────────────────────
drop function if exists public.save_menu(uuid, text, date, boolean, boolean, jsonb);

create or replace function public.save_menu(
  p_menu_id uuid,
  p_title text,
  p_week_start date,
  p_order_deadline timestamptz,
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
      (title, week_start, order_deadline, published, orders_locked, created_by)
    values (
      trim(p_title),
      p_week_start,
      p_order_deadline,
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

revoke execute on function public.save_menu(uuid, text, date, timestamptz, boolean, boolean, jsonb) from public, anon;
grant execute on function public.save_menu(uuid, text, date, timestamptz, boolean, boolean, jsonb) to authenticated;

-- ─────────────────────────────────────────────────────────────────────────
-- admin_emails: the new-order notification (sent from the customer's own
-- session) needs the admins' addresses, which the tightened profiles policy
-- no longer exposes. Admin contact emails only; any signed-in user may call.
-- ─────────────────────────────────────────────────────────────────────────
create or replace function public.admin_emails()
returns text[]
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(array_agg(email), '{}')
  from public.profiles
  where is_admin and email is not null;
$$;

revoke execute on function public.admin_emails() from public, anon;
grant execute on function public.admin_emails() to authenticated;
