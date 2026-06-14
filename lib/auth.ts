import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Profile } from "@/types/database";

// Returns the currently authenticated user, or null.
export async function getUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

// Returns the signed-in user's profile (including is_admin), or null.
export async function getProfile(): Promise<Profile | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();
  return data;
}

// Use in admin Server Components/actions. Redirects non-admins away.
export async function requireAdmin(): Promise<Profile> {
  const profile = await getProfile();
  if (!profile) redirect("/login");
  if (!profile.is_admin) redirect("/");
  return profile;
}
