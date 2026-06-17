-- Let Him Cook — admin allowlist + self-service admin management.

-- Allowlist of emails that should have admin access. An entry here grants admin
-- on signup (via handle_new_user) and can promote an already-registered user.
create table if not exists public.admin_allowlist (
  email text primary key,
  added_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

alter table public.admin_allowlist enable row level security;

drop policy if exists admin_allowlist_admin_all on public.admin_allowlist;
create policy admin_allowlist_admin_all on public.admin_allowlist
  for all using (public.is_admin()) with check (public.is_admin());

-- Seed the first admin (the developer). Stored lowercase for case-insensitive matching.
insert into public.admin_allowlist (email)
values ('benjaminhunders@gmail.com')
on conflict (email) do nothing;

-- Replace the signup trigger so admin status is driven by the allowlist table.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name, avatar_url, is_admin)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name'),
    new.raw_user_meta_data ->> 'avatar_url',
    exists (
      select 1 from public.admin_allowlist a
      where lower(a.email) = lower(new.email)
    )
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

-- Admin-only RPC: allowlist an email and promote an existing matching user.
create or replace function public.add_admin(target_email text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Only admins can add admins';
  end if;
  insert into public.admin_allowlist (email, added_by)
  values (lower(target_email), auth.uid())
  on conflict (email) do nothing;
  update public.profiles set is_admin = true
  where lower(email) = lower(target_email);
end;
$$;

-- Admin-only RPC: de-allowlist + demote. Refuses to remove the caller (no lockout).
create or replace function public.remove_admin(target_email text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Only admins can remove admins';
  end if;
  if lower(target_email) = lower((select email from public.profiles where id = auth.uid())) then
    raise exception 'You cannot remove your own admin access';
  end if;
  delete from public.admin_allowlist where lower(email) = lower(target_email);
  update public.profiles set is_admin = false
  where lower(email) = lower(target_email);
end;
$$;

grant execute on function public.add_admin(text) to authenticated;
grant execute on function public.remove_admin(text) to authenticated;
