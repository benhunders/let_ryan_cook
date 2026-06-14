-- Remediate security advisor findings.

-- Public bucket serves object URLs without a SELECT policy; drop the broad
-- listing policy so clients cannot enumerate every file in the bucket.
-- (Image <img> URLs still resolve via the public object endpoint.)
drop policy if exists dish_images_public_read on storage.objects;

-- The signup trigger function must never be callable via the REST API.
revoke execute on function public.handle_new_user() from public;

-- Admin RPCs are guarded internally (they raise unless the caller is_admin),
-- but anonymous users never need them: restrict to signed-in users only.
revoke execute on function public.add_admin(text) from public;
revoke execute on function public.remove_admin(text) from public;
grant execute on function public.add_admin(text) to authenticated;
grant execute on function public.remove_admin(text) to authenticated;
