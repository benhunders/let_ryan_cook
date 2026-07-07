import Link from "next/link";
import { getProfile } from "@/lib/auth";
import { NavDrawer } from "./NavDrawer";

// Server component: loads the profile, then hands auth state to the client
// drawer. The top bar stays minimal (hamburger + brand); page links live in
// the slide-in drawer.
export async function Nav() {
  const profile = await getProfile();

  return (
    <header className="border-b border-black/10 bg-white/70 backdrop-blur sticky top-0 z-30">
      <nav className="max-w-5xl mx-auto px-4 h-14 flex items-center gap-3">
        <NavDrawer
          isLoggedIn={!!profile}
          isAdmin={!!profile?.is_admin}
          displayName={profile?.full_name ?? profile?.email ?? null}
        />
        <Link href="/" className="font-bold text-lg text-brand">
          Let Him Cook 🍳
        </Link>
      </nav>
    </header>
  );
}

