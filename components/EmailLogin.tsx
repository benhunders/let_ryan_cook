"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

// Passwordless email sign-in (magic link). Works for anyone with an email
// address — no Google account required. The link lands on /auth/callback,
// which exchanges the code for a session just like the OAuth flow.
export function EmailLogin({ next }: { next: string }) {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent">("idle");
  const [error, setError] = useState<string | null>(null);

  async function sendLink(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setStatus("sending");
    const supabase = createClient();
    const { error: err } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(
          next
        )}`,
      },
    });
    if (err) {
      setStatus("idle");
      setError(err.message);
      return;
    }
    setStatus("sent");
  }

  if (status === "sent") {
    return (
      <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
        Check <strong>{email}</strong> for a sign-in link. You can close this
        tab once you&apos;ve clicked it.
      </div>
    );
  }

  return (
    <form onSubmit={sendLink} className="flex flex-col gap-2 text-left">
      <label htmlFor="email" className="text-sm font-medium text-black/70">
        Or sign in with email
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
      {error && <p className="text-sm text-red-700">{error}</p>}
      <button
        type="submit"
        disabled={status === "sending"}
        className="rounded-lg bg-black px-4 py-3 font-medium text-white shadow-sm hover:bg-black/85 disabled:opacity-60"
      >
        {status === "sending" ? "Sending…" : "Email me a sign-in link"}
      </button>
    </form>
  );
}
