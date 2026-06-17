"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type Mode = "signin" | "signup" | "forgot";

// Email + password sign-in / sign-up, plus a passwordless "forgot password"
// reset. Sign-in/up need no SMTP (with email confirmation disabled); the reset
// flow does send an email, so it only works once SMTP is configured.
export function EmailPasswordAuth({ next }: { next: string }) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  function switchMode(m: Mode) {
    setMode(m);
    setError(null);
    setSent(false);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    const supabase = createClient();

    if (mode === "forgot") {
      const { error: err } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth/callback?next=/reset-password`,
      });
      setBusy(false);
      if (err) {
        setError(err.message);
        return;
      }
      setSent(true);
      return;
    }

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

  if (mode === "forgot" && sent) {
    return (
      <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-left text-sm text-green-800">
        If an account exists for <strong>{email}</strong>, a password-reset link
        is on its way. Check your inbox.
        <button
          type="button"
          onClick={() => switchMode("signin")}
          className="mt-2 block text-black/50 hover:text-black/80"
        >
          Back to sign in
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-2 text-left">
      <label htmlFor="email" className="text-sm font-medium text-black/70">
        {mode === "signup"
          ? "Create an account"
          : mode === "forgot"
            ? "Reset your password"
            : "Sign in with email"}
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
      {mode !== "forgot" && (
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
      )}
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
            : mode === "forgot"
              ? "Email me a reset link"
              : "Sign in"}
      </button>

      <div className="flex items-center justify-between text-sm text-black/50">
        {mode === "signin" ? (
          <>
            <button
              type="button"
              onClick={() => switchMode("forgot")}
              className="hover:text-black/80"
            >
              Forgot password?
            </button>
            <button
              type="button"
              onClick={() => switchMode("signup")}
              className="hover:text-black/80"
            >
              Create an account
            </button>
          </>
        ) : (
          <button
            type="button"
            onClick={() => switchMode("signin")}
            className="hover:text-black/80"
          >
            Back to sign in
          </button>
        )}
      </div>
    </form>
  );
}
