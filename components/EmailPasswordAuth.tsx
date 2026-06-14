"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

// Email + password sign-in / sign-up. Needs no SMTP as long as email
// confirmation is disabled in Supabase (Authentication → Providers → Email):
// signUp then returns a session immediately and we redirect straight in.
export function EmailPasswordAuth({ next }: { next: string }) {
  const router = useRouter();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    const supabase = createClient();
    const { error: err } =
      mode === "signup"
        ? await supabase.auth.signUp({ email, password })
        : await supabase.auth.signInWithPassword({ email, password });
    if (err) {
      setBusy(false);
      setError(err.message);
      return;
    }
    router.push(next);
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-2 text-left">
      <label htmlFor="email" className="text-sm font-medium text-black/70">
        {mode === "signup" ? "Create an account" : "Sign in with email"}
      </label>
      <input
        id="email"
        type="email"
        required
        autoComplete="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="you@example.com"
        className="w-full rounded-lg border border-black/15 px-4 py-3 shadow-sm outline-none focus:border-black/40"
      />
      <input
        id="password"
        type="password"
        required
        minLength={6}
        autoComplete={mode === "signup" ? "new-password" : "current-password"}
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        placeholder="Password (at least 6 characters)"
        className="w-full rounded-lg border border-black/15 px-4 py-3 shadow-sm outline-none focus:border-black/40"
      />
      {error && <p className="text-sm text-red-700">{error}</p>}
      <button
        type="submit"
        disabled={busy}
        className="rounded-lg bg-black px-4 py-3 font-medium text-white shadow-sm hover:bg-black/85 disabled:opacity-60"
      >
        {busy
          ? "Please wait…"
          : mode === "signup"
            ? "Create account"
            : "Sign in"}
      </button>
      <button
        type="button"
        onClick={() => {
          setMode(mode === "signup" ? "signin" : "signup");
          setError(null);
        }}
        className="text-sm text-black/50 hover:text-black/80"
      >
        {mode === "signup"
          ? "Already have an account? Sign in"
          : "New here? Create an account"}
      </button>
    </form>
  );
}
