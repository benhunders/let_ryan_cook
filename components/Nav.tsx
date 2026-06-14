import Link from "next/link";
import { getProfile } from "@/lib/auth";

// Server component: shows brand + auth-aware links.
export async function Nav() {
  const profile = await getProfile();

  return (
    <header className="border-b border-black/10 bg-white/70 backdrop-blur sticky top-0 z-10">
      <nav className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between">
        <Link href="/" className="font-bold text-lg text-brand">
          Let Ryan Cook 🍳
        </Link>
        <div className="flex items-center gap-4 text-sm">
          {profile?.is_admin && (
            <Link href="/admin" className="hover:text-brand font-medium">
              Chef dashboard
            </Link>
          )}
          {profile ? (
            <>
              <Link href="/orders" className="hover:text-brand">
                My order
              </Link>
              <Link href="/account" className="hover:text-brand">
                Account
              </Link>
              <span className="hidden sm:inline text-black/50">
                {profile.full_name ?? profile.email}
              </span>
              <form action="/auth/signout" method="post">
                <button
                  type="submit"
                  className="rounded-md border border-black/15 px-3 py-1 hover:bg-black/5"
                >
                  Sign out
                </button>
              </form>
            </>
          ) : (
            <Link
              href="/login"
              className="rounded-md bg-brand text-white px-3 py-1.5 hover:bg-brand-dark"
            >
              Sign in
            </Link>
          )}
        </div>
      </nav>
    </header>
  );
}
