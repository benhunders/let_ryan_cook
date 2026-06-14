import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "@/types/database";

// Browser-side Supabase client. Reads the session from cookies set during the
// OAuth callback, so RLS policies apply on behalf of the signed-in user.
export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
