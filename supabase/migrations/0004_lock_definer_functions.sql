-- Tighten EXECUTE on SECURITY DEFINER functions (Supabase grants to anon/
-- authenticated by default; the earlier `from public` revoke didn't cover them).

-- Trigger-only function: no role needs to call it directly.
revoke execute on function public.handle_new_user() from anon, authenticated;

-- Admin RPCs: only signed-in users (admins) call these; anon never should.
revoke execute on function public.add_admin(text) from anon;
revoke execute on function public.remove_admin(text) from anon;

-- NOTE: public.is_admin() intentionally stays executable by anon + authenticated
-- because the RLS policies invoke it; it only ever returns the caller's own
-- admin flag, so it is safe.
