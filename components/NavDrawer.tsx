"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";

// Client-side hamburger + left slide-in drawer. The server `Nav` passes the
// auth-derived data so this stays a thin interactive shell.
//
// The overlay (backdrop + drawer) is rendered into a portal on document.body.
// This is important: the header uses `backdrop-blur`, and an element with
// backdrop-filter becomes the containing block for fixed-position descendants —
// which would otherwise clip the drawer to the header's height. Portaling to
// body lets the fixed elements size against the real viewport.
export function NavDrawer({
  isLoggedIn,
  isAdmin,
  displayName,
}: {
  isLoggedIn: boolean;
  isAdmin: boolean;
  displayName: string | null;
}) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  // Portals need a DOM target. useSyncExternalStore gives an SSR-safe
  // "are we on the client yet" flag without setState-in-effect: false during
  // SSR/first render, true once hydrated.
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false
  );

  // While open: lock body scroll and close on Escape.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open]);

  const links = [
    { href: "/", label: "Home" },
    ...(isLoggedIn
      ? [
          { href: "/orders", label: "My order" },
          { href: "/feedback", label: "Feedback" },
          { href: "/account", label: "Account" },
        ]
      : []),
    ...(isAdmin ? [{ href: "/admin", label: "Chef dashboard" }] : []),
  ];

  function isActive(href: string) {
    return href === "/" ? pathname === "/" : pathname.startsWith(href);
  }

  const overlay = (
    <>
      {/* Backdrop */}
      <div
        onClick={() => setOpen(false)}
        aria-hidden
        className={`fixed inset-0 z-40 bg-black/40 transition-opacity duration-200 ${
          open ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
      />

      {/* Drawer */}
      <aside
        role="dialog"
        aria-modal="true"
        aria-label="Navigation"
        className={`fixed left-0 top-0 z-50 flex h-dvh w-72 max-w-[80%] flex-col bg-white shadow-xl transition-transform duration-200 ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex h-14 shrink-0 items-center justify-between border-b border-black/10 px-4">
          <span className="text-lg font-bold text-brand">Let Him Cook 🍳</span>
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label="Close menu"
            className="-mr-2 rounded-md p-2 hover:bg-black/5"
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            >
              <line x1="6" y1="6" x2="18" y2="18" />
              <line x1="18" y1="6" x2="6" y2="18" />
            </svg>
          </button>
        </div>

        <nav className="min-h-0 flex-1 overflow-y-auto p-2">
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              onClick={() => setOpen(false)}
              aria-current={isActive(l.href) ? "page" : undefined}
              className={`block rounded-md px-3 py-2.5 font-medium ${
                isActive(l.href)
                  ? "bg-brand/10 text-brand-dark"
                  : "hover:bg-black/5"
              }`}
            >
              {l.label}
            </Link>
          ))}
        </nav>

        <div className="shrink-0 border-t border-black/10 p-4">
          {isLoggedIn ? (
            <>
              {displayName && (
                <div className="mb-2 truncate text-sm text-black/50">
                  {displayName}
                </div>
              )}
              <form action="/auth/signout" method="post">
                <button
                  type="submit"
                  className="w-full rounded-md border border-black/15 px-3 py-2 hover:bg-black/5"
                >
                  Sign out
                </button>
              </form>
            </>
          ) : (
            <Link
              href="/login"
              onClick={() => setOpen(false)}
              className="block w-full rounded-md bg-brand px-3 py-2 text-center font-medium text-white hover:bg-brand-dark"
            >
              Sign in
            </Link>
          )}
        </div>
      </aside>
    </>
  );

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Open menu"
        aria-expanded={open}
        className="-ml-2 rounded-md p-2 hover:bg-black/5"
      >
        <svg
          width="22"
          height="22"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
        >
          <line x1="3" y1="6" x2="21" y2="6" />
          <line x1="3" y1="12" x2="21" y2="12" />
          <line x1="3" y1="18" x2="21" y2="18" />
        </svg>
      </button>

      {mounted && createPortal(overlay, document.body)}
    </>
  );
}
