-- Order deadline. Customers must place or change their order before this time
-- (defaults to Friday 21:00 in the chef's timezone), giving Ryan time to build
-- the grocery list and plan Sunday's cooking. Stored as an absolute timestamp.

alter table public.menus
  add column if not exists order_deadline timestamptz;

-- Enforce the deadline in the database, not just the UI. Customers may only
-- create/change/cancel their order, and modify its items, before the menu's
-- deadline. A null deadline means no cutoff. Admins are never blocked.

drop policy if exists orders_insert_own on public.orders;
create policy orders_insert_own on public.orders
  for insert to authenticated
  with check (
    auth.uid() = user_id
    and (
      public.is_admin()
      or exists (
        select 1 from public.menus m
        where m.id = orders.menu_id
          and (m.order_deadline is null or now() < m.order_deadline)
      )
    )
  );

drop policy if exists orders_update_own on public.orders;
create policy orders_update_own on public.orders
  for update to authenticated
  using (auth.uid() = user_id)
  with check (
    auth.uid() = user_id
    and (
      public.is_admin()
      or exists (
        select 1 from public.menus m
        where m.id = orders.menu_id
          and (m.order_deadline is null or now() < m.order_deadline)
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
      or exists (
        select 1 from public.menus m
        where m.id = orders.menu_id
          and (m.order_deadline is null or now() < m.order_deadline)
      )
    )
  );

-- order_items modifications (insert/update/delete) are gated by the deadline
-- too. SELECT is unaffected because the separate order_items_select policy
-- still grants read access (RLS policies are OR'd), so customers can always
-- view a past order.
drop policy if exists order_items_modify_own on public.order_items;
create policy order_items_modify_own on public.order_items
  for all to authenticated
  using (
    exists (
      select 1 from public.orders o
      join public.menus m on m.id = o.menu_id
      where o.id = order_items.order_id
        and o.user_id = auth.uid()
        and (
          public.is_admin()
          or m.order_deadline is null
          or now() < m.order_deadline
        )
    )
  )
  with check (
    exists (
      select 1 from public.orders o
      join public.menus m on m.id = o.menu_id
      where o.id = order_items.order_id
        and o.user_id = auth.uid()
        and (
          public.is_admin()
          or m.order_deadline is null
          or now() < m.order_deadline
        )
    )
  );
