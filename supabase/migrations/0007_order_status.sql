-- Order status workflow. The orders.status column already exists (default
-- 'submitted') but was never advanced. This constrains it to known states,
-- records when it last changed, and lets admins (Ryan) update it.

alter table public.orders
  add column if not exists status_updated_at timestamptz;

-- Restrict status to the defined state machine. Existing rows are 'submitted',
-- which satisfies the constraint.
alter table public.orders drop constraint if exists orders_status_check;
alter table public.orders add constraint orders_status_check
  check (status in ('submitted', 'preparing', 'ready', 'completed', 'cancelled'));

-- Admins may update any order (to advance its status). This is additive to the
-- existing orders_update_own policy, so customers can still edit their own
-- order. Policies for the same command are OR'd.
drop policy if exists orders_update_admin on public.orders;
create policy orders_update_admin on public.orders
  for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());
